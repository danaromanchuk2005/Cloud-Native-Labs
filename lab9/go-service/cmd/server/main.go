package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
	_ "go.uber.org/automaxprocs"
)

var (
	logger   *slog.Logger
	hostname string

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duration of HTTP requests in seconds",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5},
		},
		[]string{"method", "route", "status"},
	)
)

func init() {
	hostname, _ = os.Hostname()
	baseHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	logger = slog.New(baseHandler).With(
		"service", "go-api",
		"replica", hostname,
	)
	prometheus.MustRegister(httpRequestDuration)
}

func initTracer(ctx context.Context) (*sdktrace.TracerProvider, error) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "jaeger:4318"
	}
	endpoint = strings.TrimPrefix(endpoint, "http://")
	endpoint = strings.TrimPrefix(endpoint, "https://")

	exporter, err := otlptracehttp.New(
		ctx,
		otlptracehttp.WithEndpoint(endpoint),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(
		ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String("go-api"),
		),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)
	return tp, nil
}

func generateReqID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func observabilityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}

		start := time.Now()
		reqID := r.Header.Get("X-Request-Id")
		if reqID == "" {
			reqID = generateReqID()
		}

		spanCtx := trace.SpanFromContext(r.Context()).SpanContext()
		traceID := ""
		if spanCtx.HasTraceID() {
			traceID = spanCtx.TraceID().String()
		}

		w.Header().Set("X-Request-Id", reqID)
		if traceID != "" {
			w.Header().Set("X-Trace-Id", traceID)
		}

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		duration := time.Since(start).Seconds()
		route := r.URL.Path
		httpRequestDuration.WithLabelValues(r.Method, route, strconv.Itoa(rec.status)).Observe(duration)

		clientIP := r.Header.Get("X-Real-IP")
		if clientIP == "" {
			clientIP = r.RemoteAddr
		}

		logger.Info(
			"request completed",
			"reqId", reqID,
			"trace_id", traceID,
			"method", r.Method,
			"url", r.URL.Path,
			"status", rec.status,
			"durationMs", float64(time.Since(start).Microseconds())/1000.0,
			"client_ip", clientIP,
		)
	})
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		client := &http.Client{Timeout: 2 * time.Second}
		resp, err := client.Get("http://127.0.0.1:8080/health")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	ctx := context.Background()
	tp, err := initTracer(ctx)
	if err != nil {
		logger.Warn("failed to init tracer", "err", err.Error())
	} else {
		defer func() {
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = tp.Shutdown(shutdownCtx)
		}()
	}

	tracer := otel.Tracer("go-api-service")
	mux := http.NewServeMux()

	mux.Handle("/metrics", promhttp.Handler())

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":     "ok",
			"service":    "go-app",
			"replica":    hostname,
			"gomaxprocs": runtime.GOMAXPROCS(0),
		})
	})

	mux.HandleFunc("/api/reports", func(w http.ResponseWriter, r *http.Request) {
		_, span := tracer.Start(r.Context(), "reports.generate")
		span.SetAttributes(
			attribute.String("op", "generateSummaryReport"),
			attribute.String("report.type", "system_summary"),
		)
		defer span.End()

		clientIP := r.Header.Get("X-Real-IP")
		if clientIP == "" {
			clientIP = r.RemoteAddr
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"report":     "System Summary Report",
			"service":    "go-app",
			"replica":    hostname,
			"gomaxprocs": runtime.GOMAXPROCS(0),
			"clientIp":   clientIP,
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":  "served_by_backup",
			"service": "go-app",
			"replica": hostname,
		})
	})

	handler := otelhttp.NewHandler(observabilityMiddleware(mux), "go-api")

	srv := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	go func() {
		logger.Info("Go service listening", "port", 8080, "gomaxprocs", runtime.GOMAXPROCS(0))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("listen error", "err", err.Error())
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	logger.Info("SIGTERM received, shutting down gracefully")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown error", "err", err.Error())
	}
	_ = fmt.Sprintf("stopped")
}

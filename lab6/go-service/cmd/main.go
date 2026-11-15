package main

import (
	"bufio"
	"context"
	"fmt"
	"go-persistence-service/internal/controller"
	"go-persistence-service/internal/db"
	"go-persistence-service/internal/events"
	"go-persistence-service/internal/middleware"
	"go-persistence-service/internal/repository"
	"go-persistence-service/internal/service"
	"go-persistence-service/internal/websocket"
	"log"
	"net/http"
	"os"
	"strings"
)

func loadEnv(paths ...string) {
	for _, p := range paths {
		f, err := os.Open(p)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if k, v, ok := strings.Cut(line, "="); ok && os.Getenv(strings.TrimSpace(k)) == "" {
				_ = os.Setenv(strings.TrimSpace(k), strings.TrimSpace(v))
			}
		}
		_ = f.Close()
		break
	}
}

func main() {
	loadEnv(".env", "../.env")
	ctx := context.Background()

	pgDB, err := db.NewPostgresDB(ctx,
		os.Getenv("PG_HOST"), os.Getenv("PG_PORT"),
		os.Getenv("PG_USER"), os.Getenv("PG_PASSWORD"), os.Getenv("PG_DB"),
	)
	if err != nil {
		log.Fatalf("PostgreSQL connection failed: %v", err)
	}
	defer pgDB.Close()

	mongoClient, mongoDB, err := db.NewMongoDB(ctx, os.Getenv("MONGO_URI"), os.Getenv("MONGO_DB"))
	if err != nil {
		log.Fatalf("MongoDB connection failed: %v", err)
	}
	defer func() { _ = mongoClient.Disconnect(ctx) }()

	pgRepo := repository.NewPostgresUserRepository(pgDB)
	mongoRepo := repository.NewMongoUserRepository(mongoDB)

	// Перемикання сховища одним параметром REPO_TYPE без зміни бізнес-коду[cite: 28, 31]
	repoType := strings.ToLower(os.Getenv("REPO_TYPE"))
	var userRepo repository.UserRepository
	switch repoType {
	case "mongo":
		userRepo = mongoRepo
	default:
		repoType = "postgres"
		userRepo = pgRepo
	}

	logger := events.NewMongoEventLogger(mongoDB)
	hub := websocket.NewHub()
	svc := service.NewUserService(userRepo, logger, hub)
	ctrl := controller.NewUserController(svc, pgRepo, logger, hub)

	mux := http.NewServeMux()
	ctrl.RegisterRoutes(mux)

	port := "8080"
	fmt.Printf("Go Lab 6 server running on http://localhost:%s [REPO_TYPE=%s]\n", port, repoType)
	log.Fatal(http.ListenAndServe(":"+port, middleware.RequestLogging(mux)))
}
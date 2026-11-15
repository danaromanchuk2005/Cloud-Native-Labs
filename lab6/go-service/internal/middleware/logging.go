package middleware

import (
	"fmt"
	"net/http"
	"time"
)

func RequestLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		fmt.Printf("%s %s %dms\n", r.Method, r.URL.Path, time.Since(start).Milliseconds())
	})
}
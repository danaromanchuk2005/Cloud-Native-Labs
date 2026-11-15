package middleware

import (
	"fmt"
	"go-book-service/internal/apperror"
	"net/http"
	"strconv"
	"strings"
)

// RequestValidation перевіряє коректність ID у шляху та Content-Type для POST/PUT[cite: 15, 16, 18]
func RequestValidation(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/books/") {
			rawID := strings.TrimPrefix(r.URL.Path, "/api/books/")
			id, err := strconv.Atoi(rawID)
			if err != nil || id <= 0 {
				apperror.WriteError(w, apperror.BadRequest(
					"invalid_id",
					fmt.Sprintf("Invalid identifier %q. Must be a positive integer", rawID),
				))
				return
			}
		}

		if r.Method == http.MethodPost || r.Method == http.MethodPut {
			ct := r.Header.Get("Content-Type")
			if !strings.HasPrefix(ct, "application/json") {
				apperror.WriteError(w, apperror.BadRequest(
					"unsupported_media_type",
					"Content-Type must be application/json",
				))
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}
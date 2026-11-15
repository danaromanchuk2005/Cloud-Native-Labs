package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Book struct {
	ID     int    `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
	Year   *int   `json:"year"`
}

type BookStore struct {
	mu     sync.RWMutex
	books  []Book
	nextID int
}

func NewBookStore() *BookStore {
	y1, y2 := 2017, 2017
	return &BookStore{
		books: []Book{
			{ID: 1, Title: "Clean Architecture", Author: "Robert C. Martin", Year: &y1},
			{ID: 2, Title: "Designing Data-Intensive Applications", Author: "Martin Kleppmann", Year: &y2},
		},
		nextID: 3,
	}
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

func main() {
	store := NewBookStore()
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status":    "ok",
			"service":   "go-books-service",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("GET /books", func(w http.ResponseWriter, r *http.Request) {
		store.mu.RLock()
		defer store.mu.RUnlock()

		writeJSON(w, http.StatusOK, store.books)
	})

	mux.HandleFunc("GET /books/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID format"})
			return
		}

		store.mu.RLock()
		defer store.mu.RUnlock()

		for _, b := range store.books {
			if b.ID == id {
				writeJSON(w, http.StatusOK, b)
				return
			}
		}

		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Book not found"})
	})

	mux.HandleFunc("POST /books", func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Title  string `json:"title"`
			Author string `json:"author"`
			Year   *int   `json:"year"`
		}

		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}

		title := strings.TrimSpace(input.Title)
		author := strings.TrimSpace(input.Author)
		if title == "" || author == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": `Fields "title" and "author" are required`})
			return
		}

		store.mu.Lock()
		newBook := Book{
			ID:     store.nextID,
			Title:  title,
			Author: author,
			Year:   input.Year,
		}
		store.nextID++
		store.books = append(store.books, newBook)
		store.mu.Unlock()

		writeJSON(w, http.StatusCreated, newBook)
	})

	mux.HandleFunc("PUT /books/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID format"})
			return
		}

		var input struct {
			Title  string `json:"title"`
			Author string `json:"author"`
			Year   *int   `json:"year"`
		}

		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}

		title := strings.TrimSpace(input.Title)
		author := strings.TrimSpace(input.Author)
		if title == "" || author == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": `Fields "title" and "author" are required`})
			return
		}

		store.mu.Lock()
		defer store.mu.Unlock()

		for i, b := range store.books {
			if b.ID == id {
				store.books[i] = Book{
					ID:     id,
					Title:  title,
					Author: author,
					Year:   input.Year,
				}
				writeJSON(w, http.StatusOK, store.books[i])
				return
			}
		}

		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Book not found"})
	})

	mux.HandleFunc("DELETE /books/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid ID format"})
			return
		}

		store.mu.Lock()
		defer store.mu.Unlock()

		for i, b := range store.books {
			if b.ID == id {
				store.books = append(store.books[:i], store.books[i+1:]...)
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}

		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Book not found"})
	})

	port := 8080
	fmt.Printf("Go server is running on http://localhost:%d\n", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), mux))
}
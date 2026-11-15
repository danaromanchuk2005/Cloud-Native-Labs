package controller

import (
	"encoding/json"
	"go-book-service/internal/apperror"
	"go-book-service/internal/service"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type BookController struct {
	service *service.BookService
}

func NewBookController(s *service.BookService) *BookController {
	return &BookController{service: s}
}

type bookRequest struct {
	Title  string `json:"title"`
	Author string `json:"author"`
	Year   *int   `json:"year"`
}

func parseAndValidateBook(r *http.Request) (bookRequest, error) {
	var req bookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return req, apperror.BadRequest("invalid_json", "Malformed JSON request body")
	}
	if strings.TrimSpace(req.Title) == "" {
		return req, apperror.BadRequest("validation_error", `Field "title" is required and must be non-empty`)
	}
	if strings.TrimSpace(req.Author) == "" {
		return req, apperror.BadRequest("validation_error", `Field "author" is required and must be non-empty`)
	}
	if req.Year != nil && (*req.Year < 1000 || *req.Year > 2100) {
		return req, apperror.BadRequest("validation_error", `Field "year" must be between 1000 and 2100`)
	}
	return req, nil
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

// RegisterRoutes прив'язує маршрути до методів контролера (Router layer)[cite: 11, 18]
func (c *BookController) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", c.Health)
	mux.HandleFunc("GET /api/books", c.GetAll)
	mux.HandleFunc("GET /api/books/{id}", c.GetByID)
	mux.HandleFunc("POST /api/books", c.Create)
	mux.HandleFunc("PUT /api/books/{id}", c.Update)
	mux.HandleFunc("DELETE /api/books/{id}", c.Delete)
}

func (c *BookController) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":    "ok",
		"service":   "go-books-layered-service",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func (c *BookController) GetAll(w http.ResponseWriter, _ *http.Request) {
	books, err := c.service.GetAllBooks()
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, books)
}

func (c *BookController) GetByID(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(r.PathValue("id"))
	book, err := c.service.GetBookByID(id)
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, book)
}

func (c *BookController) Create(w http.ResponseWriter, r *http.Request) {
	req, err := parseAndValidateBook(r)
	if err != nil {
		apperror.WriteError(w, err)
		return
	}

	created, err := c.service.CreateBook(req.Title, req.Author, req.Year)
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (c *BookController) Update(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(r.PathValue("id"))
	req, err := parseAndValidateBook(r)
	if err != nil {
		apperror.WriteError(w, err)
		return
	}

	updated, err := c.service.UpdateBook(id, req.Title, req.Author, req.Year)
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (c *BookController) Delete(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(r.PathValue("id"))
	if err := c.service.DeleteBook(id); err != nil {
		apperror.WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
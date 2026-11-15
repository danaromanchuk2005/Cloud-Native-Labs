package tests

import (
	"bytes"
	"go-book-service/internal/controller"
	"go-book-service/internal/middleware"
	"go-book-service/internal/model"
	"go-book-service/internal/repository"
	"go-book-service/internal/service"
	"net/http"
	"net/http/httptest"
	"testing"
)

func setupTestServer() *httptest.Server {
	y := 2017
	repo := repository.NewInMemoryBookRepository([]model.Book{
		{ID: 1, Title: "Clean Architecture", Author: "Robert C. Martin", Year: &y},
	})
	svc := service.NewBookService(repo)
	ctrl := controller.NewBookController(svc)

	mux := http.NewServeMux()
	ctrl.RegisterRoutes(mux)
	return httptest.NewServer(middleware.RequestValidation(mux))
}

func TestBooksAPI(t *testing.T) {
	ts := setupTestServer()
	defer ts.Close()

	// 1. Успішний GET
	resp, err := http.Get(ts.URL + "/api/books")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %v, err=%v", resp.StatusCode, err)
	}

	// 2. Успішний POST
	resp, err = http.Post(ts.URL+"/api/books", "application/json",
		bytes.NewBufferString(`{"title":"Refactoring","author":"Martin Fowler","year":2018}`))
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d, err=%v", resp.StatusCode, err)
	}

	// 3. Некоректний POST (400)
	resp, _ = http.Post(ts.URL+"/api/books", "application/json", bytes.NewBufferString(`{"title":""}`))
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d", resp.StatusCode)
	}

	// 4. GET неіснуючого ресурсу (404)
	resp, _ = http.Get(ts.URL + "/api/books/999")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found, got %d", resp.StatusCode)
	}

	// 5. DELETE (204)
	req, _ := http.NewRequest(http.MethodDelete, ts.URL+"/api/books/2", nil)
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204 No Content, got %d", resp.StatusCode)
	}
}
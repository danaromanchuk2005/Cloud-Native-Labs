package tests

import (
	"errors"
	"go-book-service/internal/apperror"
	"go-book-service/internal/model"
	"go-book-service/internal/repository"
	"go-book-service/internal/service"
	"testing"
)

func TestBookService(t *testing.T) {
	y := 2008
	repo := repository.NewInMemoryBookRepository([]model.Book{
		{ID: 1, Title: "Clean Code", Author: "Robert C. Martin", Year: &y},
	})
	svc := service.NewBookService(repo)

	// 1. Створення сутності
	created, err := svc.CreateBook("The Pragmatic Programmer", "Andrew Hunt", nil)
	if err != nil || created.ID != 2 {
		t.Fatalf("expected created book with ID 2, got %+v, err=%v", created, err)
	}

	// 2. Бізнес-правило: дублікат повертає 409 Conflict
	_, err = svc.CreateBook("clean code", "Robert C. Martin", nil)
	var appErr *apperror.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != 409 {
		t.Fatalf("expected 409 ConflictError, got %v", err)
	}

	// 3. Пошук та обробка помилки 404
	if _, err := svc.GetBookByID(999); !errors.As(err, &appErr) || appErr.StatusCode != 404 {
		t.Fatalf("expected 404 NotFoundError, got %v", err)
	}

	// 4. Оновлення
	updated, err := svc.UpdateBook(1, "Clean Code Updated", "Robert C. Martin", &y)
	if err != nil || updated.Title != "Clean Code Updated" {
		t.Fatalf("expected updated book, got %+v, err=%v", updated, err)
	}

	// 5. Видалення
	if err := svc.DeleteBook(1); err != nil {
		t.Fatalf("expected no error on delete, got %v", err)
	}
	if _, err := svc.GetBookByID(1); err == nil {
		t.Fatalf("expected error after deletion")
	}
}
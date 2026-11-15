package unit

import (
	"context"
	"errors"
	"go-persistence-service/internal/apperror"
	"go-persistence-service/internal/repository"
	"go-persistence-service/internal/service"
	"testing"
)

func TestUserServiceWithInMemoryRepo(t *testing.T) {
	ctx := context.Background()
	repo := repository.NewInMemoryUserRepository()
	svc := service.NewUserService(repo, nil, nil)

	created, err := svc.Create(ctx, "Alice", "alice@example.com")
	if err != nil || created.ID != "1" {
		t.Fatalf("expected created user ID 1, got %+v, err=%v", created, err)
	}

	// Перевірка 409 Conflict при дублюванні email[cite: 28, 31]
	_, err = svc.Create(ctx, "Alice 2", "alice@example.com")
	var appErr *apperror.AppError
	if !errors.As(err, &appErr) || appErr.StatusCode != 409 {
		t.Fatalf("expected 409 Conflict, got %v", err)
	}

	// Оновлення та видалення
	updated, err := svc.Update(ctx, "1", "Alice Updated")
	if err != nil || updated.Name != "Alice Updated" {
		t.Fatalf("expected updated user, got %+v, err=%v", updated, err)
	}

	if err := svc.Delete(ctx, "1"); err != nil {
		t.Fatalf("expected delete success, got %v", err)
	}
	if _, err := svc.GetByID(ctx, "1"); !errors.As(err, &appErr) || appErr.StatusCode != 404 {
		t.Fatalf("expected 404 Not Found, got %v", err)
	}
}
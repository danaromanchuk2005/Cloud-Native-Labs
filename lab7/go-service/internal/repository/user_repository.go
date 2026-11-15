package repository

import (
	"context"
	"go-persistence-service/internal/model"
)

type UserRepository interface {
	Create(ctx context.Context, name, email string) (*model.User, error)
	FindByID(ctx context.Context, id string) (*model.User, error)
	FindAll(ctx context.Context) ([]model.User, error)
	Update(ctx context.Context, id, name string) (*model.User, error)
	Delete(ctx context.Context, id string) (bool, error)
}
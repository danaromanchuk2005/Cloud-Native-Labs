package service

import (
	"context"
	"go-persistence-service/internal/apperror"
	"go-persistence-service/internal/events"
	"go-persistence-service/internal/model"
	"go-persistence-service/internal/repository"
	"go-persistence-service/internal/websocket"
	"time"
)

type UserService struct {
	repo   repository.UserRepository
	logger *events.MongoEventLogger
	hub    *websocket.Hub
}

func NewUserService(repo repository.UserRepository, logger *events.MongoEventLogger, hub *websocket.Hub) *UserService {
	return &UserService{repo: repo, logger: logger, hub: hub}
}

func (s *UserService) GetAll(ctx context.Context) ([]model.User, error) {
	return s.repo.FindAll(ctx)
}

func (s *UserService) GetByID(ctx context.Context, id string) (*model.User, error) {
	u, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, apperror.NotFound("user_not_found", "User not found")
	}
	return u, nil
}

func (s *UserService) Create(ctx context.Context, name, email string) (*model.User, error) {
	u, err := s.repo.Create(ctx, name, email)
	if err != nil {
		return nil, err
	}
	if s.logger != nil {
		_ = s.logger.Log(ctx, "user_created", u)
	}
	if s.hub != nil {
		s.hub.BroadcastJSON(map[string]any{
			"type":      "user_created",
			"data":      u,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
	return u, nil
}

func (s *UserService) Update(ctx context.Context, id, name string) (*model.User, error) {
	u, err := s.repo.Update(ctx, id, name)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, apperror.NotFound("user_not_found", "User not found")
	}
	if s.logger != nil {
		_ = s.logger.Log(ctx, "user_updated", u)
	}
	if s.hub != nil {
		s.hub.BroadcastJSON(map[string]any{
			"type":      "user_updated",
			"data":      u,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
	return u, nil
}

func (s *UserService) Delete(ctx context.Context, id string) error {
	ok, err := s.repo.Delete(ctx, id)
	if err != nil {
		return err
	}
	if !ok {
		return apperror.NotFound("user_not_found", "User not found")
	}
	payload := map[string]string{"id": id}
	if s.logger != nil {
		_ = s.logger.Log(ctx, "user_deleted", payload)
	}
	if s.hub != nil {
		s.hub.BroadcastJSON(map[string]any{
			"type":      "user_deleted",
			"data":      payload,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
	return nil
}
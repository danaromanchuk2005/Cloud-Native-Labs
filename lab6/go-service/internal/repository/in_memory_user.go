package repository

import (
	"context"
	"go-persistence-service/internal/apperror"
	"go-persistence-service/internal/model"
	"strconv"
	"strings"
	"sync"
	"time"
)

type InMemoryUserRepository struct {
	mu     sync.RWMutex
	users  []model.User
	nextID int
}

func NewInMemoryUserRepository() *InMemoryUserRepository {
	return &InMemoryUserRepository{users: []model.User{}, nextID: 1}
}

func (r *InMemoryUserRepository) Create(_ context.Context, name, email string) (*model.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	for _, u := range r.users {
		if u.Email == cleanEmail {
			return nil, apperror.Conflict("email_already_exists", "User with this email already exists")
		}
	}

	u := model.User{
		ID:        strconv.Itoa(r.nextID),
		Name:      strings.TrimSpace(name),
		Email:     cleanEmail,
		CreatedAt: time.Now().UTC(),
	}
	r.nextID++
	r.users = append(r.users, u)
	return &u, nil
}

func (r *InMemoryUserRepository) FindByID(_ context.Context, id string) (*model.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, u := range r.users {
		if u.ID == id {
			copyU := u
			return &copyU, nil
		}
	}
	return nil, nil
}

func (r *InMemoryUserRepository) FindAll(_ context.Context) ([]model.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	res := make([]model.User, len(r.users))
	copy(res, r.users)
	return res, nil
}

func (r *InMemoryUserRepository) Update(_ context.Context, id, name string) (*model.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, u := range r.users {
		if u.ID == id {
			r.users[i].Name = strings.TrimSpace(name)
			copyU := r.users[i]
			return &copyU, nil
		}
	}
	return nil, nil
}

func (r *InMemoryUserRepository) Delete(_ context.Context, id string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, u := range r.users {
		if u.ID == id {
			r.users = append(r.users[:i], r.users[i+1:]...)
			return true, nil
		}
	}
	return false, nil
}
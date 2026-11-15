package controller

import (
	"encoding/csv"
	"encoding/json"
	"go-persistence-service/internal/apperror"
	"go-persistence-service/internal/events"
	"go-persistence-service/internal/repository"
	"go-persistence-service/internal/service"
	"go-persistence-service/internal/websocket"
	"net/http"
	"os"
	"strings"
	"time"
)

type UserController struct {
	svc    *service.UserService
	pgRepo *repository.PostgresUserRepository
	logger *events.MongoEventLogger
	hub    *websocket.Hub
}

func NewUserController(
	svc *service.UserService,
	pgRepo *repository.PostgresUserRepository,
	logger *events.MongoEventLogger,
	hub *websocket.Hub,
) *UserController {
	return &UserController{svc: svc, pgRepo: pgRepo, logger: logger, hub: hub}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func (c *UserController) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /ws", c.hub.HandleWS)
	mux.HandleFunc("GET /api/users/export", c.ExportCSV)
	mux.HandleFunc("GET /api/users", c.GetAll)
	mux.HandleFunc("GET /api/users/{id}", c.GetByID)
	mux.HandleFunc("POST /api/users", c.Create)
	mux.HandleFunc("PUT /api/users/{id}", c.Update)
	mux.HandleFunc("DELETE /api/users/{id}", c.Delete)
	mux.HandleFunc("GET /api/events", c.GetEvents)
	mux.HandleFunc("POST /api/accounts/transfer", c.Transfer)
}

func (c *UserController) GetAll(w http.ResponseWriter, r *http.Request) {
	users, err := c.svc.GetAll(r.Context())
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (c *UserController) GetByID(w http.ResponseWriter, r *http.Request) {
	u, err := c.svc.GetByID(r.Context(), r.PathValue("id"))
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (c *UserController) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" || !strings.Contains(body.Email, "@") {
		apperror.WriteError(w, apperror.BadRequest("validation_error", "Valid name and email are required"))
		return
	}
	u, err := c.svc.Create(r.Context(), body.Name, body.Email)
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func (c *UserController) Update(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		apperror.WriteError(w, apperror.BadRequest("validation_error", "Valid name is required"))
		return
	}
	u, err := c.svc.Update(r.Context(), r.PathValue("id"), body.Name)
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (c *UserController) Delete(w http.ResponseWriter, r *http.Request) {
	if err := c.svc.Delete(r.Context(), r.PathValue("id")); err != nil {
		apperror.WriteError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (c *UserController) GetEvents(w http.ResponseWriter, r *http.Request) {
	ev, err := c.logger.GetRecent(r.Context(), 25)
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ev)
}

func (c *UserController) Transfer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FromAccountID int     `json:"fromAccountId"`
		ToAccountID   int     `json:"toAccountId"`
		Amount        float64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperror.WriteError(w, apperror.BadRequest("invalid_json", "Invalid JSON body"))
		return
	}
	if err := c.pgRepo.TransferFunds(r.Context(), body.FromAccountID, body.ToAccountID, body.Amount); err != nil {
		apperror.WriteError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "committed", "amount": body.Amount})
}

func (c *UserController) ExportCSV(w http.ResponseWriter, r *http.Request) {
	users, err := c.svc.GetAll(r.Context())
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	file, err := os.Create("data/export.csv")
	if err != nil {
		apperror.WriteError(w, err)
		return
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	_ = writer.Write([]string{"id", "name", "email", "createdAt"})
	for i, u := range users {
		_ = writer.Write([]string{u.ID, u.Name, u.Email, u.CreatedAt.Format(time.RFC3339)})
		c.hub.BroadcastJSON(map[string]any{
			"type":      "export_progress",
			"processed": i + 1,
			"total":     len(users),
		})
	}
	writer.Flush()
	writeJSON(w, http.StatusOK, map[string]any{"exported": len(users), "file": "data/export.csv"})
}
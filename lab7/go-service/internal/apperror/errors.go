package apperror

import (
	"encoding/json"
	"errors"
	"net/http"
)

type AppError struct {
	StatusCode int    `json:"-"`
	Code       string `json:"error"`
	Message    string `json:"message"`
}

func (e *AppError) Error() string { return e.Message }

func BadRequest(code, msg string) *AppError {
	return &AppError{StatusCode: http.StatusBadRequest, Code: code, Message: msg}
}

func NotFound(code, msg string) *AppError {
	return &AppError{StatusCode: http.StatusNotFound, Code: code, Message: msg}
}

func Conflict(code, msg string) *AppError {
	return &AppError{StatusCode: http.StatusConflict, Code: code, Message: msg}
}

func WriteError(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "application/json")
	var appErr *AppError
	if errors.As(err, &appErr) {
		w.WriteHeader(appErr.StatusCode)
		_ = json.NewEncoder(w).Encode(appErr)
		return
	}
	w.WriteHeader(http.StatusInternalServerError)
	_ = json.NewEncoder(w).Encode(AppError{Code: "internal_server_error", Message: err.Error()})
}
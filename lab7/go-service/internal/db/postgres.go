package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func NewPostgresDB(ctx context.Context, host, port, user, password, dbName string) (*sql.DB, error) {
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, password, host, port, dbName)
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}

	// Go обробляє запити у багатьох паралельних горутинах -> пул 25-50 з'єднань[cite: 28, 30]
	db.SetMaxOpenConns(30)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}
	return db, nil
}
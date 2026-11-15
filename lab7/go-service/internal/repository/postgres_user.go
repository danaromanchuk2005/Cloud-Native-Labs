package repository

import (
	"context"
	"database/sql"
	"errors"
	"go-persistence-service/internal/apperror"
	"go-persistence-service/internal/model"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

type PostgresUserRepository struct {
	db *sql.DB
}

func NewPostgresUserRepository(db *sql.DB) *PostgresUserRepository {
	return &PostgresUserRepository{db: db}
}

func (r *PostgresUserRepository) Create(ctx context.Context, name, email string) (*model.User, error) {
	var id int
	var u model.User
	err := r.db.QueryRowContext(
		ctx,
		`INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at`,
		strings.TrimSpace(name),
		strings.ToLower(strings.TrimSpace(email)),
	).Scan(&id, &u.Name, &u.Email, &u.CreatedAt)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, apperror.Conflict("email_already_exists", "User with this email already exists")
		}
		return nil, err
	}
	u.ID = strconv.Itoa(id)
	return &u, nil
}

func (r *PostgresUserRepository) FindByID(ctx context.Context, id string) (*model.User, error) {
	numID, err := strconv.Atoi(id)
	if err != nil {
		return nil, nil
	}
	var dbID int
	var u model.User
	err = r.db.QueryRowContext(
		ctx,
		`SELECT id, name, email, created_at FROM users WHERE id = $1`,
		numID,
	).Scan(&dbID, &u.Name, &u.Email, &u.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.ID = strconv.Itoa(dbID)
	return &u, nil
}

func (r *PostgresUserRepository) FindAll(ctx context.Context) ([]model.User, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, email, created_at FROM users ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []model.User{}
	for rows.Next() {
		var dbID int
		var u model.User
		if err := rows.Scan(&dbID, &u.Name, &u.Email, &u.CreatedAt); err != nil {
			return nil, err
		}
		u.ID = strconv.Itoa(dbID)
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *PostgresUserRepository) Update(ctx context.Context, id, name string) (*model.User, error) {
	numID, err := strconv.Atoi(id)
	if err != nil {
		return nil, nil
	}
	var dbID int
	var u model.User
	err = r.db.QueryRowContext(
		ctx,
		`UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, created_at`,
		strings.TrimSpace(name),
		numID,
	).Scan(&dbID, &u.Name, &u.Email, &u.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.ID = strconv.Itoa(dbID)
	return &u, nil
}

func (r *PostgresUserRepository) Delete(ctx context.Context, id string) (bool, error) {
	numID, err := strconv.Atoi(id)
	if err != nil {
		return false, nil
	}
	res, err := r.db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, numID)
	if err != nil {
		return false, err
	}
	affected, err := res.RowsAffected()
	return affected > 0, err
}

// TransferFunds реалізує транзакцію переказу між рахунками з BEGIN / COMMIT / ROLLBACK[cite: 28, 32]
func (r *PostgresUserRepository) TransferFunds(ctx context.Context, fromID, toID int, amount float64) error {
	if fromID == toID || amount <= 0 {
		return apperror.BadRequest("invalid_transfer", "Invalid accounts or non-positive amount")
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var balance float64
	err = tx.QueryRowContext(ctx, `SELECT balance FROM accounts WHERE id = $1 FOR UPDATE`, fromID).Scan(&balance)
	if errors.Is(err, sql.ErrNoRows) {
		return apperror.NotFound("account_not_found", "Source account not found")
	}
	if err != nil {
		return err
	}
	if balance < amount {
		return apperror.BadRequest("insufficient_funds", "Insufficient balance for transfer")
	}

	var destID int
	err = tx.QueryRowContext(ctx, `SELECT id FROM accounts WHERE id = $1 FOR UPDATE`, toID).Scan(&destID)
	if errors.Is(err, sql.ErrNoRows) {
		return apperror.NotFound("account_not_found", "Destination account not found")
	}
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `UPDATE accounts SET balance = balance - $1 WHERE id = $2`, amount, fromID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE accounts SET balance = balance + $1 WHERE id = $2`, amount, toID); err != nil {
		return err
	}

	return tx.Commit()
}
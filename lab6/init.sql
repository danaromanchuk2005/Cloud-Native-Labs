CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    id       SERIAL PRIMARY KEY,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance  NUMERIC(12,2) NOT NULL DEFAULT 0.00
);

-- Початкові користувачі та рахунки для демонстрації транзакцій
INSERT INTO users (id, name, email) VALUES
    (1, 'Alice Smith', 'alice@example.com'),
    (2, 'Bob Johnson', 'bob@example.com')
ON CONFLICT (email) DO NOTHING;

SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));

INSERT INTO accounts (id, user_id, balance) VALUES
    (1, 1, 1000.00),
    (2, 2, 500.00)
ON CONFLICT (id) DO NOTHING;

SELECT setval('accounts_id_seq', COALESCE((SELECT MAX(id) FROM accounts), 1));
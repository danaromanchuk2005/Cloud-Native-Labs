CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    id       SERIAL PRIMARY KEY,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance  NUMERIC(12,2) NOT NULL DEFAULT 0.00
);

-- Тестовий admin користувач (пароль: Admin123!)
INSERT INTO users (id, name, email, password_hash, role) VALUES
    (1, 'Admin User', 'admin@example.com', '$2b$12$Kixu8vYf5a1y5H7vW2QeZuebXmZq9X2j8fQ5v5J7vW2QeZuebXmZq', 'admin')
ON CONFLICT (email) DO NOTHING;

SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
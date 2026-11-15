import { UserRepository } from './user.repository.js';
import { User } from '../models/user.js';
import { ConflictError } from '../errors/app-error.js';

export class PostgresUserRepository extends UserRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  mapRow(row) {
    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at
    });
  }

  async create(name, email) {
    try {
      const { rows } = await this.pool.query(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
        [name.trim(), email.trim().toLowerCase()]
      );
      return this.mapRow(rows[0]);
    } catch (err) {
      // Код 23505 у PostgreSQL означає порушення UNIQUE constraint
      if (err.code === '23505') {
        throw new ConflictError('email_already_exists', `User with email "${email}" already exists`);
      }
      throw err;
    }
  }

  async findById(id) {
    if (!/^\d+$/.test(String(id))) return null;
    const { rows } = await this.pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [Number(id)]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findAll() {
    const { rows } = await this.pool.query(
      'SELECT id, name, email, created_at FROM users ORDER BY id ASC'
    );
    return rows.map((r) => this.mapRow(r));
  }

  async update(id, name) {
    if (!/^\d+$/.test(String(id))) return null;
    const { rows } = await this.pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, created_at',
      [name.trim(), Number(id)]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async delete(id) {
    if (!/^\d+$/.test(String(id))) return false;
    const { rowCount } = await this.pool.query(
      'DELETE FROM users WHERE id = $1',
      [Number(id)]
    );
    return rowCount > 0;
  }

  async countAll() {
    const { rows } = await this.pool.query('SELECT COUNT(*)::int AS total FROM users');
    return rows[0].total;
  }

  async *iterateBatches(batchSize = 50) {
    let lastId = 0;
    while (true) {
      const { rows } = await this.pool.query(
        'SELECT id, name, email, created_at FROM users WHERE id > $1 ORDER BY id ASC LIMIT $2',
        [lastId, batchSize]
      );
      if (rows.length === 0) break;
      lastId = rows[rows.length - 1].id;
      yield rows.map((r) => this.mapRow(r));
    }
  }
}
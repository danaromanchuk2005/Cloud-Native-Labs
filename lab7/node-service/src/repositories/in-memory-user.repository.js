import { UserRepository } from './user.repository.js';
import { User } from '../models/user.js';
import { ConflictError } from '../errors/app-error.js';

export class InMemoryUserRepository extends UserRepository {
  constructor(initialUsers = []) {
    super();
    this.users = initialUsers.map((u) => new User(u));
    this.nextId = this.users.length > 0
      ? Math.max(...this.users.map((u) => Number(u.id))) + 1
      : 1;
  }

  async create(name, email) {
    const normalizedEmail = email.trim().toLowerCase();
    if (this.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new ConflictError('email_already_exists', `User with email "${email}" already exists`);
    }
    const created = new User({
      id: this.nextId++,
      name: name.trim(),
      email: normalizedEmail,
      createdAt: new Date()
    });
    this.users.push(created);
    return new User(created);
  }

  async findById(id) {
    const found = this.users.find((u) => u.id === String(id));
    return found ? new User(found) : null;
  }

  async findAll() {
    return this.users.map((u) => new User(u));
  }

  async update(id, name) {
    const idx = this.users.findIndex((u) => u.id === String(id));
    if (idx === -1) return null;
    this.users[idx].name = name.trim();
    return new User(this.users[idx]);
  }

  async delete(id) {
    const idx = this.users.findIndex((u) => u.id === String(id));
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    return true;
  }

  async countAll() {
    return this.users.length;
  }

  async *iterateBatches(batchSize = 50) {
    for (let i = 0; i < this.users.length; i += batchSize) {
      yield this.users.slice(i, i + batchSize).map((u) => new User(u));
    }
  }
}
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryUserRepository } from '../../src/repositories/in-memory-user.repository.js';
import { UserService } from '../../src/services/user.service.js';
import { ConflictError, NotFoundError } from '../../src/errors/app-error.js';

describe('UserService unit tests (InMemoryUserRepository)', () => {
  let service;

  beforeEach(() => {
    const repo = new InMemoryUserRepository([
      { id: 1, name: 'Alice', email: 'alice@example.com' }
    ]);
    service = new UserService(repo);
  });

  it('creates user and prevents duplicate email (409 Conflict)', async () => {
    const created = await service.createUser('Bob', 'bob@example.com');
    assert.equal(created.id, '2');

    await assert.rejects(
      () => service.createUser('Alice 2', 'alice@example.com'),
      ConflictError
    );
  });

  it('updates and deletes user, throws 404 when missing', async () => {
    const updated = await service.updateUser('1', 'Alice Updated');
    assert.equal(updated.name, 'Alice Updated');

    await service.deleteUser('1');
    await assert.rejects(() => service.getUserById('1'), NotFoundError);
  });
});
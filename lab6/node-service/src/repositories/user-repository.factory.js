import { PostgresUserRepository } from './postgres-user.repository.js';
import { MongoUserRepository } from './mongo-user.repository.js';
import { InMemoryUserRepository } from './in-memory-user.repository.js';

export function createUserRepository({ repoType, pgPool, mongoDb }) {
  switch (repoType) {
    case 'postgres':
      return new PostgresUserRepository(pgPool);
    case 'mongo':
      return new MongoUserRepository(mongoDb);
    case 'memory':
      return new InMemoryUserRepository();
    default:
      throw new Error(`Unsupported REPO_TYPE: "${repoType}". Expected "postgres" | "mongo" | "memory"`);
  }
}
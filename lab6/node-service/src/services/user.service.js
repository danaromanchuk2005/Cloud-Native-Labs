import { NotFoundError } from '../errors/app-error.js';

export class UserService {
  constructor(userRepository, eventLogger = null, wsManager = null) {
    this.userRepository = userRepository;
    this.eventLogger = eventLogger;
    this.wsManager = wsManager;
  }

  async getAllUsers() {
    return this.userRepository.findAll();
  }

  async getUserById(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('user_not_found', `User with id "${id}" not found`);
    }
    return user;
  }

  async createUser(name, email) {
    const created = await this.userRepository.create(name, email);

    if (this.eventLogger) {
      await this.eventLogger.log('user_created', created);
    }
    if (this.wsManager) {
      this.wsManager.broadcast({
        type: 'user_created',
        data: created,
        timestamp: new Date().toISOString()
      });
    }
    return created;
  }

  async updateUser(id, name) {
    const updated = await this.userRepository.update(id, name);
    if (!updated) {
      throw new NotFoundError('user_not_found', `User with id "${id}" not found`);
    }

    if (this.eventLogger) {
      await this.eventLogger.log('user_updated', updated);
    }
    if (this.wsManager) {
      this.wsManager.broadcast({
        type: 'user_updated',
        data: updated,
        timestamp: new Date().toISOString()
      });
    }
    return updated;
  }

  async deleteUser(id) {
    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('user_not_found', `User with id "${id}" not found`);
    }

    const payload = { id: String(id) };
    if (this.eventLogger) {
      await this.eventLogger.log('user_deleted', payload);
    }
    if (this.wsManager) {
      this.wsManager.broadcast({
        type: 'user_deleted',
        data: payload,
        timestamp: new Date().toISOString()
      });
    }
  }
}
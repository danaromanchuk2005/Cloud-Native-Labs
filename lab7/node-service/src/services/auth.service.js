import { hashPassword, verifyPassword } from '../auth/password.js';
import { JwtService } from '../auth/jwt.service.js';
import { UnauthorizedError, ConflictError, NotFoundError } from '../errors/app-error.js';

export class AuthService {
  constructor(userRepository, eventLogger = null, wsManager = null) {
    this.userRepository = userRepository;
    this.eventLogger = eventLogger;
    this.wsManager = wsManager;
  }

  async register(name, email, password) {
    const passwordHash = await hashPassword(password);
    const user = await this.userRepository.createWithHash(name, email, passwordHash, 'user');

    if (this.eventLogger) {
      await this.eventLogger.log('user_registered', { id: user.id, email: user.email });
    }
    if (this.wsManager) {
      this.wsManager.broadcast({
        type: 'user_registered',
        data: { id: user.id, name: user.name },
        timestamp: new Date().toISOString()
      });
    }
    return user;
  }

  async login(email, password) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      if (this.eventLogger) await this.eventLogger.log('login_failed', { email });
      throw new UnauthorizedError('invalid_credentials', 'Invalid credentials');
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      if (this.eventLogger) await this.eventLogger.log('login_failed', { email });
      throw new UnauthorizedError('invalid_credentials', 'Invalid credentials');
    }

    const accessToken = JwtService.generateAccessToken(user);
    const refreshToken = JwtService.generateRefreshToken(user);

    if (this.eventLogger) {
      await this.eventLogger.log('user_logged_in', { id: user.id });
    }

    return { accessToken, refreshToken, user };
  }

  async refresh(refreshToken) {
    const payload = JwtService.verifyRefreshToken(refreshToken);
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError('user_not_found', 'User no longer exists');
    }

    const accessToken = JwtService.generateAccessToken(user);
    const newRefreshToken = JwtService.generateRefreshToken(user);
    return { accessToken, refreshToken: newRefreshToken };
  }
}
import { exportUsersToCsvStream } from '../streams/export-stream.js';

export class UserController {
  constructor({ userService, userRepository, accountRepository, eventLogger, wsManager }) {
    this.userService = userService;
    this.userRepository = userRepository;
    this.accountRepository = accountRepository;
    this.eventLogger = eventLogger;
    this.wsManager = wsManager;
  }

  getAll = async (_req, res, next) => {
    try {
      res.status(200).json(await this.userService.getAllUsers());
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      res.status(200).json(await this.userService.getUserById(req.params.id));
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const { name, email } = req.body;
      const created = await this.userService.createUser(name, email);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const updated = await this.userService.updateUser(req.params.id, req.body.name);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.userService.deleteUser(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  exportCsv = async (_req, res, next) => {
    try {
      const result = await exportUsersToCsvStream({
        userRepository: this.userRepository,
        wsManager: this.wsManager
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getEvents = async (_req, res, next) => {
    try {
      const events = await this.eventLogger.getRecent(25);
      res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  };

  getAccounts = async (_req, res, next) => {
    try {
      res.status(200).json(await this.accountRepository.findAll());
    } catch (err) {
      next(err);
    }
  };

  transferFunds = async (req, res, next) => {
    try {
      const { fromAccountId, toAccountId, amount } = req.body || {};
      const result = await this.accountRepository.transfer(
        Number(fromAccountId),
        Number(toAccountId),
        Number(amount)
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
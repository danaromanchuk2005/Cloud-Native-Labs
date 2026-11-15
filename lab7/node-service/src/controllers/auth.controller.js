export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  register = async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      const user = await this.authService.register(name, email, password);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  };

  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const tokens = await this.authService.login(email, password);
      res.status(200).json(tokens);
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      const tokens = await this.authService.refresh(refreshToken);
      res.status(200).json(tokens);
    } catch (err) {
      next(err);
    }
  };
}
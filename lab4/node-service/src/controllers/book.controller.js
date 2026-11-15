export class BookController {
  constructor(bookService) {
    this.bookService = bookService;
  }

  getAll = async (req, res, next) => {
    try {
      const books = await this.bookService.getAllBooks();
      res.status(200).json(books);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const book = await this.bookService.getBookById(req.parsedId);
      res.status(200).json(book);
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const { title, author, year } = req.body;
      const created = await this.bookService.createBook({ title, author, year });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const { title, author, year } = req.body;
      const updated = await this.bookService.updateBook(req.parsedId, { title, author, year });
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.bookService.deleteBook(req.parsedId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
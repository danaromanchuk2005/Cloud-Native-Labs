import { ConflictError, NotFoundError } from '../errors/app-error.js';

export class BookService {
  constructor(bookRepository) {
    this.bookRepository = bookRepository;
  }

  async getAllBooks() {
    return this.bookRepository.findAll();
  }

  async getBookById(id) {
    const book = await this.bookRepository.findById(id);
    if (!book) {
      throw new NotFoundError('book_not_found', `Book with id ${id} was not found`);
    }
    return book;
  }

  async createBook({ title, author, year }) {
    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();

    // Бізнес-правило: заборона дублювання книги з тією ж назвою та автором
    const existing = await this.bookRepository.findByTitleAndAuthor(cleanTitle, cleanAuthor);
    if (existing) {
      throw new ConflictError(
        'book_already_exists',
        `Book "${cleanTitle}" by ${cleanAuthor} already exists`
      );
    }

    return this.bookRepository.create({
      title: cleanTitle,
      author: cleanAuthor,
      year: year ?? null
    });
  }

  async updateBook(id, { title, author, year }) {
    const current = await this.bookRepository.findById(id);
    if (!current) {
      throw new NotFoundError('book_not_found', `Book with id ${id} was not found`);
    }

    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();

    const duplicate = await this.bookRepository.findByTitleAndAuthor(cleanTitle, cleanAuthor);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(
        'book_already_exists',
        `Book "${cleanTitle}" by ${cleanAuthor} already exists`
      );
    }

    return this.bookRepository.update(id, {
      title: cleanTitle,
      author: cleanAuthor,
      year: year ?? null
    });
  }

  async deleteBook(id) {
    const deleted = await this.bookRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('book_not_found', `Book with id ${id} was not found`);
    }
  }
}
import { Book } from '../models/book.js';

// Базовий контракт репозиторію (дозволяє замінити сховище без змін у Service)[cite: 16, 17, 18]
export class BookRepository {
  async findAll() { throw new Error('Not implemented'); }
  async findById(id) { throw new Error('Not implemented'); }
  async findByTitleAndAuthor(title, author) { throw new Error('Not implemented'); }
  async create(bookData) { throw new Error('Not implemented'); }
  async update(id, bookData) { throw new Error('Not implemented'); }
  async delete(id) { throw new Error('Not implemented'); }
}

// Реалізація збереження у пам'яті (DataStore)
export class InMemoryBookRepository extends BookRepository {
  constructor(initialBooks = []) {
    super();
    this.books = initialBooks.map((b) => new Book(b));
    this.nextId = this.books.length > 0
      ? Math.max(...this.books.map((b) => b.id)) + 1
      : 1;
  }

  async findAll() {
    return this.books.map((b) => new Book(b));
  }

  async findById(id) {
    const found = this.books.find((b) => b.id === id);
    return found ? new Book(found) : null;
  }

  async findByTitleAndAuthor(title, author) {
    const t = title.trim().toLowerCase();
    const a = author.trim().toLowerCase();
    const found = this.books.find(
      (b) => b.title.toLowerCase() === t && b.author.toLowerCase() === a
    );
    return found ? new Book(found) : null;
  }

  async create({ title, author, year }) {
    const newBook = new Book({
      id: this.nextId++,
      title,
      author,
      year: year ?? null
    });
    this.books.push(newBook);
    return new Book(newBook);
  }

  async update(id, { title, author, year }) {
    const index = this.books.findIndex((b) => b.id === id);
    if (index === -1) return null;

    this.books[index] = new Book({
      id,
      title,
      author,
      year: year ?? null
    });
    return new Book(this.books[index]);
  }

  async delete(id) {
    const index = this.books.findIndex((b) => b.id === id);
    if (index === -1) return false;
    this.books.splice(index, 1);
    return true;
  }
}
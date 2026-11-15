import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryBookRepository } from '../src/repositories/book.repository.js';
import { BookService } from '../src/services/book.service.js';
import { ConflictError, NotFoundError } from '../src/errors/app-error.js';

describe('BookService unit tests (without HTTP server)', () => {
  let service;

  beforeEach(() => {
    const repo = new InMemoryBookRepository([
      { id: 1, title: 'Clean Code', author: 'Robert C. Martin', year: 2008 }
    ]);
    service = new BookService(repo);
  });

  it('creates a new book successfully', async () => {
    const created = await service.createBook({
      title: 'The Pragmatic Programmer',
      author: 'Andrew Hunt',
      year: 1999
    });
    assert.equal(created.id, 2);
    assert.equal(created.title, 'The Pragmatic Programmer');
  });

  it('throws ConflictError when creating duplicate book (business rule)', async () => {
    await assert.rejects(
      () => service.createBook({ title: 'clean code', author: 'Robert C. Martin', year: 2008 }),
      ConflictError
    );
  });

  it('finds existing book and throws NotFoundError for missing ID', async () => {
    const book = await service.getBookById(1);
    assert.equal(book.title, 'Clean Code');

    await assert.rejects(() => service.getBookById(999), NotFoundError);
  });

  it('updates an existing book', async () => {
    const updated = await service.updateBook(1, {
      title: 'Clean Code (2nd Ed)',
      author: 'Robert C. Martin',
      year: 2020
    });
    assert.equal(updated.year, 2020);
  });

  it('deletes an existing book and throws NotFoundError afterwards', async () => {
    await service.deleteBook(1);
    await assert.rejects(() => service.getBookById(1), NotFoundError);
  });
});
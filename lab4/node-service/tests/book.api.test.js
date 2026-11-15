import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

describe('Books API integration tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp({ enableLogging: false });
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    server.close();
  });

  it('GET /api/books returns 200 and list of books', async () => {
    const res = await fetch(`${baseUrl}/api/books`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(Array.isArray(body), true);
    assert.equal(body.length, 2);
  });

  it('POST /api/books creates a book with 201 Created', async () => {
    const res = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Refactoring', author: 'Martin Fowler', year: 2018 })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.id, 3);
    assert.equal(body.title, 'Refactoring');
  });

  it('POST /api/books returns 400 Bad Request on invalid payload or malformed JSON', async () => {
    const badPayload = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' })
    });
    assert.equal(badPayload.status, 400);

    const badJson = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json'
    });
    assert.equal(badJson.status, 400);
    const errBody = await badJson.json();
    assert.equal(errBody.error, 'invalid_json');
  });

  it('POST /api/books returns 409 Conflict on duplicate book', async () => {
    const res = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Refactoring', author: 'Martin Fowler', year: 2018 })
    });
    assert.equal(res.status, 409);
  });

  it('GET /api/books/999 returns 404 Not Found', async () => {
    const res = await fetch(`${baseUrl}/api/books/999`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'book_not_found');
  });

  it('DELETE /api/books/3 deletes resource with 204 No Content', async () => {
    const res = await fetch(`${baseUrl}/api/books/3`, { method: 'DELETE' });
    assert.equal(res.status, 204);
  });
});
import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

let books = [
  { id: 1, title: 'Clean Architecture', author: 'Robert C. Martin', year: 2017 },
  { id: 2, title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', year: 2017 }
];
let nextId = 3;

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'node-books-service',
    timestamp: new Date().toISOString()
  });
});

app.get('/books', (req, res) => {
  res.status(200).json(books);
});

app.get('/books/:id', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const book = books.find((b) => b.id === id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  res.status(200).json(book);
});

app.post('/books', (req, res) => {
  const { title, author, year } = req.body;

  if (!title || !author || typeof title !== 'string' || typeof author !== 'string') {
    return res.status(400).json({ error: 'Fields "title" and "author" are required' });
  }

  const newBook = {
    id: nextId++,
    title: title.trim(),
    author: author.trim(),
    year: year ? Number(year) : null
  };

  books.push(newBook);
  res.status(201).json(newBook);
});

app.put('/books/:id', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const index = books.findIndex((b) => b.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const { title, author, year } = req.body;
  if (!title || !author || typeof title !== 'string' || typeof author !== 'string') {
    return res.status(400).json({ error: 'Fields "title" and "author" are required' });
  }

  books[index] = {
    id,
    title: title.trim(),
    author: author.trim(),
    year: year ? Number(year) : null
  };

  res.status(200).json(books[index]);
});

app.delete('/books/:id', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const index = books.findIndex((b) => b.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Book not found' });
  }

  books.splice(index, 1);
  res.status(204).send();
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Node.js server is running on http://localhost:${PORT}`);
});
import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

let books = [
  { id: 1, title: 'Clean Architecture', author: 'Robert C. Martin', year: 2017 },
  { id: 2, title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', year: 2017 }
];
let nextId = 3;

// Helper: важке синхронне обчислення (цикл інкременту)
function heavyComputation(iterations) {
  let counter = 0;
  for (let i = 0; i < iterations; i++) {
    counter += 1;
  }
  return counter;
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'node-books-service',
    timestamp: new Date().toISOString()
  });
});

// Лаба 2: Асинхронна I/O операція (імітація очікування 100 мс)
app.get('/io', async (req, res) => {
  const delayMs = Number(req.query.delay) || 100;
  const start = performance.now();

  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const durationMs = Number((performance.now() - start).toFixed(2));
  res.status(200).json({
    operation: 'io',
    runtime: 'node.js',
    delayMs,
    durationMs
  });
});

// Лаба 2: Важка CPU операція (4 цикли по 400 млн ітерацій = 1.6 млрд)
app.get('/cpu', (req, res) => {
  const tasks = 4;
  const iterationsPerTask = 400_000_000;
  const start = performance.now();

  let total = 0;
  for (let t = 0; t < tasks; t++) {
    total += heavyComputation(iterationsPerTask);
  }

  const durationMs = Number((performance.now() - start).toFixed(2));
  res.status(200).json({
    operation: 'cpu',
    runtime: 'node.js',
    tasks,
    total,
    durationMs
  });
});

// --- CRUD із Лабораторної роботи 1 ---
app.get('/books', (req, res) => res.status(200).json(books));

app.get('/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const book = books.find((b) => b.id === id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.status(200).json(book);
});

app.post('/books', (req, res) => {
  const { title, author, year } = req.body;
  if (!title || !author) return res.status(400).json({ error: 'Fields "title" and "author" are required' });
  const newBook = { id: nextId++, title: title.trim(), author: author.trim(), year: year ? Number(year) : null };
  books.push(newBook);
  res.status(201).json(newBook);
});

app.put('/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = books.findIndex((b) => b.id === id);
  if (index === -1) return res.status(404).json({ error: 'Book not found' });
  const { title, author, year } = req.body;
  if (!title || !author) return res.status(400).json({ error: 'Fields "title" and "author" are required' });
  books[index] = { id, title: title.trim(), author: author.trim(), year: year ? Number(year) : null };
  res.status(200).json(books[index]);
});

app.delete('/books/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = books.findIndex((b) => b.id === id);
  if (index === -1) return res.status(404).json({ error: 'Book not found' });
  books.splice(index, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Node.js Lab 2 server running on http://localhost:${PORT}`);
});
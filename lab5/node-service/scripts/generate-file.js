import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, '..', 'data', 'books-events.ndjson');

const TOTAL_LINES = 1_200_000; // ~120 MB
const categories = ['Architecture', 'Distributed Systems', 'Cloud Native', 'Databases', 'Networking'];

async function generate() {
  console.log(`Генерація тестового файлу (${TOTAL_LINES.toLocaleString()} записів)...`);
  const start = performance.now();
  const stream = fs.createWriteStream(outputPath, { highWaterMark: 64 * 1024 });

  for (let i = 1; i <= TOTAL_LINES; i++) {
    const record = JSON.stringify({
      eventId: i,
      bookId: (i % 500) + 1,
      category: categories[i % categories.length],
      action: i % 3 === 0 ? 'BORROW' : 'VIEW',
      rating: (i % 5) + 1,
      timestamp: '2026-11-15T03:00:00.000Z'
    }) + '\n';

    if (!stream.write(record)) {
      await new Promise((resolve) => stream.once('drain', resolve));
    }
  }

  await new Promise((resolve) => stream.end(resolve));
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  console.log(`Готово: ${outputPath} (${sizeMB} MB) за ${elapsed} с`);
}

generate();
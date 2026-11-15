import fs from 'node:fs';
import path from 'node:path';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, '..', 'data', 'books-events.ndjson');
const outA = path.join(__dirname, '..', 'data', 'bench-out-a.ndjson');
const outB = path.join(__dirname, '..', 'data', 'bench-out-b.ndjson');

// Читаємо перші 25 MB файлу для наочного та швидкого бенчмарку (~400 chunks по 64 KB)
const SLICE_BYTES = 25 * 1024 * 1024;
const CHUNK_DELAY_MS = 3; // Імітація повільного споживача (3 мс на chunk)[cite: 21, 26]

function getMemoryMB() {
  const mem = process.memoryUsage();
  return {
    rss: +(mem.rss / 1024 / 1024).toFixed(2),
    heap: +(mem.heapUsed / 1024 / 1024).toFixed(2)
  };
}

// Сценарій A: передача без контролю швидкості споживача[cite: 21, 26]
async function runScenarioWithoutBackpressure() {
  if (global.gc) global.gc();
  const baseMem = getMemoryMB();
  let peakRss = baseMem.rss;
  let peakHeap = baseMem.heap;

  const sampler = setInterval(() => {
    const m = getMemoryMB();
    if (m.rss > peakRss) peakRss = m.rss;
    if (m.heap > peakHeap) peakHeap = m.heap;
  }, 20);

  const start = performance.now();
  const readable = fs.createReadStream(inputPath, { start: 0, end: SLICE_BYTES - 1, highWaterMark: 64 * 1024 });
  const fileOut = fs.createWriteStream(outA);
  const pendingWrites = [];

  await new Promise((resolve, reject) => {
    readable.on('data', (chunk) => {
      // Швидкий producer ігнорує стан споживача і планує всі записи одразу в пам'ять[cite: 21, 26]
      const transformed = Buffer.from(chunk.toString('utf8').toUpperCase());
      const task = new Promise((res) => {
        setTimeout(() => {
          fileOut.write(transformed);
          res();
        }, CHUNK_DELAY_MS * pendingWrites.length);
      });
      pendingWrites.push(task);
    });

    readable.on('end', async () => {
      await Promise.all(pendingWrites);
      fileOut.end(resolve);
    });
    readable.on('error', reject);
  });

  clearInterval(sampler);
  const durationMs = +(performance.now() - start).toFixed(2);
  return {
    scenario: 'Сценарій A (Без Backpressure)',
    durationMs,
    peakRssMB: peakRss,
    peakHeapMB: peakHeap,
    deltaRssMB: +(peakRss - baseMem.rss).toFixed(2)
  };
}

// Сценарій B: стандартний механізм Backpressure у Node.js Streams[cite: 21, 26]
async function runScenarioWithBackpressure() {
  if (global.gc) global.gc();
  const baseMem = getMemoryMB();
  let peakRss = baseMem.rss;
  let peakHeap = baseMem.heap;

  const sampler = setInterval(() => {
    const m = getMemoryMB();
    if (m.rss > peakRss) peakRss = m.rss;
    if (m.heap > peakHeap) peakHeap = m.heap;
  }, 20);

  const start = performance.now();
  const readable = fs.createReadStream(inputPath, { start: 0, end: SLICE_BYTES - 1, highWaterMark: 64 * 1024 });

  const upperTransform = new Transform({
    highWaterMark: 64 * 1024,
    transform(chunk, _enc, callback) {
      callback(null, Buffer.from(chunk.toString('utf8').toUpperCase()));
    }
  });

  const fileOut = fs.createWriteStream(outB);
  const slowWritable = new Writable({
    highWaterMark: 64 * 1024,
    write(chunk, _enc, callback) {
      // Повільний споживач затримує callback(), сигналізуючи потоку вище призупинити читання[cite: 21, 26]
      setTimeout(() => {
        fileOut.write(chunk);
        callback();
      }, CHUNK_DELAY_MS);
    },
    final(callback) {
      fileOut.end(callback);
    }
  });

  await pipeline(readable, upperTransform, slowWritable);

  clearInterval(sampler);
  const durationMs = +(performance.now() - start).toFixed(2);
  return {
    scenario: 'Сценарій B (З Backpressure)',
    durationMs,
    peakRssMB: peakRss,
    peakHeapMB: peakHeap,
    deltaRssMB: +(peakRss - baseMem.rss).toFixed(2)
  };
}

async function main() {
  console.log('Запуск порівняння Backpressure на 25 MB даних...\n');
  const resB = await runScenarioWithBackpressure();
  const resA = await runScenarioWithoutBackpressure();

  console.table([resA, resB]);
  fs.rmSync(outA, { force: true });
  fs.rmSync(outB, { force: true });
}

main();
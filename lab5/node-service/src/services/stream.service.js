import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { BookLogTransform } from '../streams/book-log.transform.js';
import { NotFoundError } from '../errors/app-error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultInputPath = path.join(__dirname, '..', '..', 'data', 'books-events.ndjson');
const defaultOutputPath = path.join(__dirname, '..', '..', 'data', 'books-processed.ndjson');

export class StreamService {
  constructor(wsManager) {
    this.wsManager = wsManager;
  }

  async processLargeFile({
    highWaterMark = 64 * 1024,
    minRating = 4,
    includeSample = false
  } = {}) {
    if (!fs.existsSync(defaultInputPath)) {
      throw new NotFoundError('source_file_missing', 'Run "node scripts/generate-file.js" first');
    }

    const totalBytes = fs.statSync(defaultInputPath).size;
    const start = performance.now();
    let lastEmitTime = 0;

    const readable = fs.createReadStream(defaultInputPath, { highWaterMark });
    const writable = fs.createWriteStream(defaultOutputPath, { highWaterMark });

    const transform = new BookLogTransform({
      totalBytes,
      minRating,
      highWaterMark,
      onProgress: ({ processed, total, linesProcessed, linesMatched, samplePayload }) => {
        const now = performance.now();
        // Надсилаємо прогрес у WebSocket клієнтам у реальному часі[cite: 24, 26]
        if (now - lastEmitTime >= 15 || processed >= total) {
          lastEmitTime = now;
          const progressEvent = {
            type: 'progress',
            processed,
            total,
            percent: +((processed / total) * 100).toFixed(1),
            linesProcessed,
            linesMatched
          };
          if (includeSample && samplePayload) {
            // Додаємо порцію даних для перевірки сценарію з повільним WebSocket-споживачем[cite: 24, 25, 26]
            progressEvent.payload = samplePayload.repeat(40);
          }
          this.wsManager.broadcast(progressEvent, null, { droppable: true });
        }
      }
    });

    await pipeline(readable, transform, writable);

    const durationMs = +(performance.now() - start).toFixed(2);
    const summary = {
      status: 'completed',
      highWaterMarkBytes: highWaterMark,
      totalBytes,
      linesProcessed: transform.linesProcessed,
      linesMatched: transform.linesMatched,
      durationMs
    };

    this.wsManager.broadcast({ type: 'stream_completed', ...summary });
    return summary;
  }
}
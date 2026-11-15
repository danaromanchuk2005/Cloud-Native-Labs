import { Transform } from 'node:stream';

export class BookLogTransform extends Transform {
  constructor({ totalBytes, minRating = 4, onProgress, highWaterMark = 64 * 1024 } = {}) {
    super({ highWaterMark });
    this.totalBytes = totalBytes;
    this.minRating = minRating;
    this.onProgress = onProgress;

    this.processedBytes = 0;
    this.linesProcessed = 0;
    this.linesMatched = 0;
    this.remainder = '';
  }

  _transform(chunk, _encoding, callback) {
    this.processedBytes += chunk.length;

    const text = this.remainder + chunk.toString('utf8');
    const lines = text.split('\n');
    this.remainder = lines.pop() ?? '';

    const outputLines = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      this.linesProcessed++;

      try {
        const parsed = JSON.parse(line);
        // Фільтруємо записи за рейтингом та додаємо мітку обробки
        if (parsed.rating >= this.minRating) {
          this.linesMatched++;
          outputLines.push(JSON.stringify({
            ...parsed,
            status: 'PROCESSED',
            priority: parsed.rating === 5 ? 'HIGH' : 'NORMAL'
          }));
        }
      } catch {
        // Пропускаємо пошкоджений рядок
      }
    }

    if (this.onProgress) {
      this.onProgress({
        processed: this.processedBytes,
        total: this.totalBytes,
        linesProcessed: this.linesProcessed,
        linesMatched: this.linesMatched,
        samplePayload: outputLines[0] || ''
      });
    }

    if (outputLines.length > 0) {
      callback(null, outputLines.join('\n') + '\n');
    } else {
      callback();
    }
  }

  _flush(callback) {
    if (this.remainder.trim()) {
      this.linesProcessed++;
    }
    callback();
  }
}
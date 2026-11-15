import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportFilePath = path.join(__dirname, '..', '..', 'data', 'export.csv');

export async function exportUsersToCsvStream({ userRepository, wsManager, batchSize = 5 }) {
  const total = await userRepository.countAll();
  let processed = 0;

  // 1. Readable Stream: читає дані з БД порціями (batch), не завантажуючи все в пам'ять[cite: 28, 33]
  const batchIterator = userRepository.iterateBatches(batchSize);
  const dbReadable = new Readable({
    objectMode: true,
    async read() {
      try {
        const { value, done } = await batchIterator.next();
        if (done) {
          this.push(null);
        } else {
          for (const user of value) {
            this.push(user);
          }
        }
      } catch (err) {
        this.destroy(err);
      }
    }
  });

  // 2. Transform Stream: перетворює User-об'єкт у CSV-рядок і надсилає WS-прогрес[cite: 28, 33]
  let headerWritten = false;
  const csvTransform = new Transform({
    writableObjectMode: true,
    transform(user, _enc, callback) {
      let chunk = '';
      if (!headerWritten) {
        chunk += 'id,name,email,createdAt\n';
        headerWritten = true;
      }
      const safeName = `"${String(user.name).replaceAll('"', '""')}"`;
      chunk += `${user.id},${safeName},${user.email},${user.createdAt}\n`;

      processed++;
      if (wsManager) {
        wsManager.broadcast({
          type: 'export_progress',
          processed,
          total
        });
      }

      callback(null, chunk);
    },
    flush(callback) {
      if (!headerWritten) {
        this.push('id,name,email,createdAt\n');
      }
      callback();
    }
  });

  // 3. Writable Stream + pipeline() з автоматичним Backpressure[cite: 28, 33]
  const fileWritable = fs.createWriteStream(exportFilePath, { highWaterMark: 16 * 1024 });
  await pipeline(dbReadable, csvTransform, fileWritable);

  return {
    file: exportFilePath,
    exportedCount: processed,
    total
  };
}
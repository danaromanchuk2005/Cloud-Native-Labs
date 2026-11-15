import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../.env')
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
      break;
    }
  }
}

loadEnvFile();

export const config = {
  port: Number(process.env.PORT) || 3000,
  repoType: (process.env.REPO_TYPE || 'postgres').toLowerCase(),
  pg: {
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT) || 5432,
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    // Event Loop у Node.js однопотоковий, тому пулу на 15 з'єднань достатньо[cite: 28, 30]
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  },
  mongo: {
    uri: process.env.MONGO_URI,
    dbName: process.env.MONGO_DB,
    maxPoolSize: 15
  }
};
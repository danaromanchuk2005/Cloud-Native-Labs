import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

export const pgPool = new Pool(config.pg);

pgPool.on('error', (err) => {
  console.error('[PostgreSQL Pool] Unexpected error on idle client:', err.message);
});
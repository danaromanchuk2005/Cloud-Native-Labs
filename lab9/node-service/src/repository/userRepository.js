const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

const pgPool = new Pool({
  host: process.env.PG_HOST || 'postgres',
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DB || 'appdb',
  user: process.env.PG_USER || 'appuser',
  password: process.env.PG_PASSWORD || 'secret'
});

let eventsCollection = null;

async function initMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://appuser:secret@mongo:27017';
  const client = new MongoClient(uri);
  await client.connect();
  eventsCollection = client.db(process.env.MONGO_DB || 'appdb').collection('events');
}

async function insertUser({ name, email, passwordHash, role }) {
  const { rows } = await pgPool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
    [name, email, passwordHash, role]
  );
  return rows[0];
}

async function findUserByEmail(email) {
  const { rows } = await pgPool.query(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
}

async function findAllUsers() {
  const { rows } = await pgPool.query(
    'SELECT id, name, email, role, created_at FROM users ORDER BY id ASC'
  );
  return rows;
}

async function insertSecurityEvent(eventDoc) {
  if (!eventsCollection) return;
  await eventsCollection.insertOne(eventDoc);
}

async function findRecentEvents(limit = 20) {
  if (!eventsCollection) return [];
  return eventsCollection.find().sort({ _id: -1 }).limit(limit).toArray();
}

async function closeConnections() {
  await pgPool.end().catch(() => {});
}

module.exports = {
  initMongo,
  insertUser,
  findUserByEmail,
  findAllUsers,
  insertSecurityEvent,
  findRecentEvents,
  closeConnections
};

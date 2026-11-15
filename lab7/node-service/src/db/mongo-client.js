import { MongoClient } from 'mongodb';
import { config } from '../config/env.js';

let client = null;
let db = null;

export async function getMongoDb() {
  if (db) return db;

  client = new MongoClient(config.mongo.uri, {
    maxPoolSize: config.mongo.maxPoolSize
  });
  await client.connect();
  db = client.db(config.mongo.dbName);

  // Створення унікального індексу на поле email при ініціалізації[cite: 28, 30]
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
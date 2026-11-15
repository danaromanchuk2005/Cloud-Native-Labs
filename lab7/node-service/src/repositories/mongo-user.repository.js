import { ObjectId } from 'mongodb';
import { UserRepository } from './user.repository.js';
import { User } from '../models/user.js';
import { ConflictError } from '../errors/app-error.js';

export class MongoUserRepository extends UserRepository {
  constructor(db) {
    super();
    this.collection = db.collection('users');
  }

  mapDoc(doc) {
    return new User({
      id: doc._id.toHexString(),
      name: doc.name,
      email: doc.email,
      createdAt: doc.createdAt
    });
  }

  async create(name, email) {
    const doc = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      createdAt: new Date()
    };
    try {
      const res = await this.collection.insertOne(doc);
      return new User({ id: res.insertedId.toHexString(), ...doc });
    } catch (err) {
      // Код 11000 у MongoDB — дублювання унікального індексу
      if (err.code === 11000) {
        throw new ConflictError('email_already_exists', `User with email "${email}" already exists`);
      }
      throw err;
    }
  }

  async findById(id) {
    if (!ObjectId.isValid(id)) return null;
    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    return doc ? this.mapDoc(doc) : null;
  }

  async findAll() {
    const docs = await this.collection.find({}).sort({ _id: 1 }).toArray();
    return docs.map((d) => this.mapDoc(d));
  }

  async update(id, name) {
    if (!ObjectId.isValid(id)) return null;
    const updated = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { name: name.trim() } },
      { returnDocument: 'after' }
    );
    return updated ? this.mapDoc(updated) : null;
  }

  async delete(id) {
    if (!ObjectId.isValid(id)) return false;
    const res = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return res.deletedCount > 0;
  }

  async countAll() {
    return this.collection.countDocuments({});
  }

  async *iterateBatches(batchSize = 50) {
    const cursor = this.collection.find({}).sort({ _id: 1 }).batchSize(batchSize);
    let batch = [];
    for await (const doc of cursor) {
      batch.push(this.mapDoc(doc));
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length > 0) yield batch;
  }
}
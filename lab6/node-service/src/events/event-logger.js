export class MongoEventLogger {
  constructor(mongoDb) {
    this.collection = mongoDb ? mongoDb.collection('events') : null;
  }

  async log(eventType, payload) {
    if (!this.collection) return;
    await this.collection.insertOne({
      type: eventType,
      payload,
      timestamp: new Date().toISOString()
    });
  }

  async getRecent(limit = 20) {
    if (!this.collection) return [];
    const docs = await this.collection
      .find({})
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();

    return docs.map((d) => ({
      id: d._id.toHexString(),
      type: d.type,
      payload: d.payload,
      timestamp: d.timestamp
    }));
  }
}
export class UserRepository {
  async create(_name, _email) { throw new Error('Not implemented'); }
  async findById(_id) { throw new Error('Not implemented'); }
  async findAll() { throw new Error('Not implemented'); }
  async update(_id, _name) { throw new Error('Not implemented'); }
  async delete(_id) { throw new Error('Not implemented'); }
  async countAll() { throw new Error('Not implemented'); }
  async *iterateBatches(_batchSize = 50) { throw new Error('Not implemented'); }
}
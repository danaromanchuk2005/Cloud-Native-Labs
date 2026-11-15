export class User {
  constructor({ id, name, email, createdAt = new Date().toISOString() }) {
    this.id = String(id);
    this.name = name;
    this.email = email;
    this.createdAt = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
  }
}
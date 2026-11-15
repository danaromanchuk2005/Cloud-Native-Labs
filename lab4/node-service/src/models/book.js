export class Book {
  constructor({ id, title, author, year = null }) {
    this.id = id;
    this.title = title;
    this.author = author;
    this.year = year;
  }
}
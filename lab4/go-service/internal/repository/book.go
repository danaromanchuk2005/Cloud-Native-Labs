package repository

import (
	"go-book-service/internal/model"
	"strings"
	"sync"
)

// BookRepository ізолює бізнес-логіку Service від конкретного сховища
type BookRepository interface {
	FindAll() ([]model.Book, error)
	FindByID(id int) (model.Book, bool, error)
	FindByTitleAndAuthor(title, author string) (model.Book, bool, error)
	Create(book model.Book) (model.Book, error)
	Update(book model.Book) (model.Book, bool, error)
	Delete(id int) (bool, error)
}

// InMemoryBookRepository реалізує BookRepository у пам'яті[cite: 16, 18]
type InMemoryBookRepository struct {
	mu     sync.RWMutex
	books  []model.Book
	nextID int
}

func NewInMemoryBookRepository(initial []model.Book) *InMemoryBookRepository {
	copied := make([]model.Book, len(initial))
	copy(copied, initial)
	maxID := 0
	for _, b := range copied {
		if b.ID > maxID {
			maxID = b.ID
		}
	}
	return &InMemoryBookRepository{
		books:  copied,
		nextID: maxID + 1,
	}
}

func (r *InMemoryBookRepository) FindAll() ([]model.Book, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	res := make([]model.Book, len(r.books))
	copy(res, r.books)
	return res, nil
}

func (r *InMemoryBookRepository) FindByID(id int) (model.Book, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, b := range r.books {
		if b.ID == id {
			return b, true, nil
		}
	}
	return model.Book{}, false, nil
}

func (r *InMemoryBookRepository) FindByTitleAndAuthor(title, author string) (model.Book, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	t := strings.ToLower(strings.TrimSpace(title))
	a := strings.ToLower(strings.TrimSpace(author))
	for _, b := range r.books {
		if strings.ToLower(b.Title) == t && strings.ToLower(b.Author) == a {
			return b, true, nil
		}
	}
	return model.Book{}, false, nil
}

func (r *InMemoryBookRepository) Create(book model.Book) (model.Book, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	book.ID = r.nextID
	r.nextID++
	r.books = append(r.books, book)
	return book, nil
}

func (r *InMemoryBookRepository) Update(book model.Book) (model.Book, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, b := range r.books {
		if b.ID == book.ID {
			r.books[i] = book
			return book, true, nil
		}
	}
	return model.Book{}, false, nil
}

func (r *InMemoryBookRepository) Delete(id int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, b := range r.books {
		if b.ID == id {
			r.books = append(r.books[:i], r.books[i+1:]...)
			return true, nil
		}
	}
	return false, nil
}
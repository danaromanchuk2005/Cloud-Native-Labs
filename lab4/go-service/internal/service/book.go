package service

import (
	"fmt"
	"go-book-service/internal/apperror"
	"go-book-service/internal/model"
	"go-book-service/internal/repository"
	"strings"
)

type BookService struct {
	repo repository.BookRepository
}

func NewBookService(repo repository.BookRepository) *BookService {
	return &BookService{repo: repo}
}

func (s *BookService) GetAllBooks() ([]model.Book, error) {
	return s.repo.FindAll()
}

func (s *BookService) GetBookByID(id int) (model.Book, error) {
	book, found, err := s.repo.FindByID(id)
	if err != nil {
		return model.Book{}, err
	}
	if !found {
		return model.Book{}, apperror.NotFound("book_not_found", fmt.Sprintf("Book with id %d was not found", id))
	}
	return book, nil
}

func (s *BookService) CreateBook(title, author string, year *int) (model.Book, error) {
	cleanTitle := strings.TrimSpace(title)
	cleanAuthor := strings.TrimSpace(author)

	if _, exists, err := s.repo.FindByTitleAndAuthor(cleanTitle, cleanAuthor); err != nil {
		return model.Book{}, err
	} else if exists {
		return model.Book{}, apperror.Conflict(
			"book_already_exists",
			fmt.Sprintf("Book %q by %s already exists", cleanTitle, cleanAuthor),
		)
	}

	return s.repo.Create(model.Book{
		Title:  cleanTitle,
		Author: cleanAuthor,
		Year:   year,
	})
}

func (s *BookService) UpdateBook(id int, title, author string, year *int) (model.Book, error) {
	if _, found, err := s.repo.FindByID(id); err != nil {
		return model.Book{}, err
	} else if !found {
		return model.Book{}, apperror.NotFound("book_not_found", fmt.Sprintf("Book with id %d was not found", id))
	}

	cleanTitle := strings.TrimSpace(title)
	cleanAuthor := strings.TrimSpace(author)

	if dup, exists, err := s.repo.FindByTitleAndAuthor(cleanTitle, cleanAuthor); err != nil {
		return model.Book{}, err
	} else if exists && dup.ID != id {
		return model.Book{}, apperror.Conflict(
			"book_already_exists",
			fmt.Sprintf("Book %q by %s already exists", cleanTitle, cleanAuthor),
		)
	}

	updated, _, err := s.repo.Update(model.Book{
		ID:     id,
		Title:  cleanTitle,
		Author: cleanAuthor,
		Year:   year,
	})
	return updated, err
}

func (s *BookService) DeleteBook(id int) error {
	deleted, err := s.repo.Delete(id)
	if err != nil {
		return err
	}
	if !deleted {
		return apperror.NotFound("book_not_found", fmt.Sprintf("Book with id %d was not found", id))
	}
	return nil
}
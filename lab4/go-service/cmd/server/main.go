package main

import (
	"fmt"
	"go-book-service/internal/controller"
	"go-book-service/internal/middleware"
	"go-book-service/internal/model"
	"go-book-service/internal/repository"
	"go-book-service/internal/service"
	"log"
	"net/http"
)

func main() {
	y1, y2 := 2017, 2017
	initialBooks := []model.Book{
		{ID: 1, Title: "Clean Architecture", Author: "Robert C. Martin", Year: &y1},
		{ID: 2, Title: "Designing Data-Intensive Applications", Author: "Martin Kleppmann", Year: &y2},
	}

	repo := repository.NewInMemoryBookRepository(initialBooks)
	svc := service.NewBookService(repo)
	ctrl := controller.NewBookController(svc)

	mux := http.NewServeMux()
	ctrl.RegisterRoutes(mux)

	// Підключення ланцюжка middleware: RequestLogging -> RequestValidation -> Router[cite: 11, 16, 18]
	handler := middleware.RequestLogging(middleware.RequestValidation(mux))

	port := 8080
	fmt.Printf("Go Lab 4 server running on http://localhost:%d\n", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), handler))
}
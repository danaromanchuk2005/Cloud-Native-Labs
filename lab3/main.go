package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// Job описує вхідну задачу для обробки[cite: 7, 10]
type Job struct {
	ID    int
	Value int
}

// Result описує результат виконання задачі[cite: 7, 10]
type Result struct {
	JobID int
	Value int
}

// Stats містить підсумкову статистику роботи pipeline
type Stats struct {
	CompletedTasks int
	TotalSum       int
	Duration       time.Duration
	Cancelled      bool
}

// compute виконує обчислення для однієї задачі (квадрат числа + контрольоване CPU-навантаження)[cite: 7, 10]
func compute(value int) int {
	base := value * value
	acc := base
	for i := 1; i <= 40000; i++ {
		acc = (acc*31 + i) % 1000000007
	}
	return base + (acc % 10)
}

// producer генерує задану кількість задач, відправляє їх у канал jobs та закриває його[cite: 7, 10]
func producer(ctx context.Context, tasksCount int, jobs chan<- Job) {
	defer close(jobs)

	for i := 1; i <= tasksCount; i++ {
		job := Job{
			ID:    i,
			Value: i,
		}

		select {
		case jobs <- job:
		case <-ctx.Done():
			return
		}
	}
}

// worker отримує задачі з каналу jobs, обробляє їх і передає результат у results
func worker(
	ctx context.Context,
	jobs <-chan Job,
	results chan<- Result,
	wg *sync.WaitGroup,
) {
	defer wg.Done()

	for {
		select {
		case job, ok := <-jobs:
			if !ok {
				// Канал jobs закрито і всі задачі вичитані — завершуємо роботу воркера[cite: 8, 10]
				return
			}

			res := Result{
				JobID: job.ID,
				Value: compute(job.Value),
			}

			select {
			case results <- res:
			case <-ctx.Done():
				return
			}

		case <-ctx.Done():
			// Отримано сигнал скасування через context.Context[cite: 8, 10]
			return
		}
	}
}

// aggregator збирає результати з каналу results і формує підсумкову статистику[cite: 8, 10]
func aggregator(ctx context.Context, results <-chan Result, startTime time.Time) Stats {
	var stats Stats

	for res := range results {
		stats.CompletedTasks++
		stats.TotalSum += res.Value
	}

	stats.Duration = time.Since(startTime)
	if ctx.Err() != nil {
		stats.Cancelled = true
	}
	return stats
}

func main() {
	// Конфігураційні параметри командного рядка[cite: 7, 8, 10]
	tasksCount := flag.Int("tasks", 10000, "Кількість задач (наприклад: 100, 1000, 10000, 100000)")
	workersCount := flag.Int("workers", 4, "Кількість воркерів (1, 2, 4, 8, 16)")
	bufferSize := flag.Int("buffer", 0, "Розмір буфера каналів (0, 10, 100, 1000)")
	timeoutMs := flag.Int("timeout", 0, "Таймаут виконання в мс (0 = без обмеження)")
	flag.Parse()

	if *tasksCount <= 0 || *workersCount <= 0 || *bufferSize < 0 {
		fmt.Println("Помилка: tasks та workers мають бути > 0, а buffer >= 0")
		os.Exit(1)
	}

	// Налаштування context.Context для підтримки скасування (за таймаутом або Ctrl+C)[cite: 8, 10]
	baseCtx, stopSignals := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignals()

	var ctx context.Context
	var cancel context.CancelFunc
	if *timeoutMs > 0 {
		ctx, cancel = context.WithTimeout(baseCtx, time.Duration(*timeoutMs)*time.Millisecond)
	} else {
		ctx, cancel = context.WithCancel(baseCtx)
	}
	defer cancel()

	// Створення unbuffered (0) або buffered (>0) каналів[cite: 8, 10]
	jobs := make(chan Job, *bufferSize)
	results := make(chan Result, *bufferSize)

	var wg sync.WaitGroup
	startTime := time.Now()

	// 1. Запуск Worker Pool[cite: 7, 8, 10]
	for w := 1; w <= *workersCount; w++ {
		wg.Add(1)
		go worker(ctx, jobs, results, &wg)
	}

	// Окрема горутина закриває канал results, щойно всі воркери завершать роботу[cite: 8, 10]
	go func() {
		wg.Wait()
		close(results)
	}()

	// 2. Запуск Producer[cite: 7, 10]
	go producer(ctx, *tasksCount, jobs)

	// 3. Запуск Aggregator та вивід статистики[cite: 7, 8, 10]
	stats := aggregator(ctx, results, startTime)
	elapsedMs := float64(stats.Duration.Microseconds()) / 1000.0

	fmt.Printf(
		"Tasks: %-7d | Workers: %-2d | Buffer: %-4d | Completed: %-7d | TotalSum: %-18d | Time: %.2f ms | Cancelled: %v\n",
		*tasksCount,
		*workersCount,
		*bufferSize,
		stats.CompletedTasks,
		stats.TotalSum,
		elapsedMs,
		stats.Cancelled,
	)
}
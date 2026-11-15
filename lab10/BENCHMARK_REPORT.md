# Lab 10: Final Observability & Benchmarking Report

## 1. Архітектура стенду
Спліт-артефакт курсу об'єднує 11 контейнерів у єдиному закритому контурі Docker Compose:
* **Периметр:** `nginx:1.27-alpine` (SSL Termination, Rate Limiting, `least_conn` балансування).
* **Флот додатків:** 3 репліки `node-service` (обфусковані через `javascript-obfuscator`, `node:20-alpine`) та 1 екземпляр `go-service` (`gcr.io/distroless/static-debian12:nonroot`).
* **Зберігання:** `postgres:16-alpine` та `mongo:7` (Polyglot Persistence, пули з'єднань, транзакції з rollback).
* **Обсерваційність:** Prometheus, Grafana, Jaeger (OTLP trace exporters), `nginx-prometheus-exporter`, структуровані JSON-логи (`pino` / `slog`).

## 2. Золоті сигнали та навантажувальні тести
* **RPS (Traffic):** Стабільне проходження піків до 1155 req/sec на Go та 1015 req/sec на Node.js флоті.
* **Latencies:** 
  * Go: `p50 = 40 ms`, `p95 = 55 ms`, `p99 = 66 ms`.
  * Node.js: `p50 = 46 ms`, `p95 = 63 ms`, `p99 = 70 ms`.
* **Saturation:** Event loop lag у Node.js залишається нижче 1 мс; кількість горутин у Go стабілізована на рівні ~11–42.

## 3. Відмовостійкість (Краш-тест)
Під час симуляції падіння однієї з реплік Node.js (`docker stop lab10-node-app-1-1`), механізм Nginx `proxy_next_upstream` миттєво переспрямовує трафік на живі інстанси (`node-app-2` та `node-app-3`). Нуль втрачених пакетів для клієнтів.

## 4. Висновки
* **Go** обирається для високопродуктивних мікросервісів, потокової обробки та мінімального споживання ресурсів (`~6.59 MB` образ бінарника).
* **Node.js** ідеально підходить для швидкої розробки гнучких CRUD-маршрутів та бізнес-логіки зі складним асинхронним I/O.

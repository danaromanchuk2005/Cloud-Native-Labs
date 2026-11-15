FROM golang:alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -trimpath -o /app/bin/app ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/bin/app /app/app
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/app"]

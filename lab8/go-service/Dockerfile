FROM golang:1.24-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -trimpath -o bin/app ./cmd/server

FROM alpine:3.20
RUN adduser -D appuser
COPY --from=build /app/bin/app /app/app
USER appuser
EXPOSE 8080
CMD ["/app/app"]

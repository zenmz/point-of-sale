include .env
export

MIGRATE = migrate -path migrations -database "$(DATABASE_URL)"

.PHONY: run build migrate-up migrate-down migrate-create tidy

run:
	go run ./cmd/api

build:
	go build -o bin/api ./cmd/api

tidy:
	go mod tidy

migrate-up:
	$(MIGRATE) up

migrate-down:
	$(MIGRATE) down 1

# Pakai: make migrate-create name=nama_migrasi
migrate-create:
	migrate create -ext sql -dir migrations -seq $(name)

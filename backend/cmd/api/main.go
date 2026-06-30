package main

import (
	"context"
	"log"

	"github.com/mzpos/backend/internal/config"
	"github.com/mzpos/backend/internal/database"
	"github.com/mzpos/backend/internal/server"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("konfigurasi tidak valid: %v", err)
	}

	pool, err := database.Connect(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database error: %v", err)
	}
	defer pool.Close()
	log.Println("database connected")

	srv := server.New(cfg, pool)

	log.Printf("MZ POS API listening on :%s (env=%s)", cfg.AppPort, cfg.AppEnv)
	if err := srv.Listen(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

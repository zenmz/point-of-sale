package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config menampung seluruh konfigurasi aplikasi dari environment.
type Config struct {
	AppPort        string
	AppEnv         string
	DatabaseURL    string
	JWTSecret      string
	JWTExpiryHours int
}

// Load membaca .env (jika ada) lalu mengisi Config dari environment.
// Nilai default dipakai bila variabel tidak diset.
func Load() *Config {
	// .env opsional — abaikan error bila tidak ada (mis. di produksi).
	_ = godotenv.Load()

	return &Config{
		AppPort:        getEnv("APP_PORT", "8080"),
		AppEnv:         getEnv("APP_ENV", "development"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://mzpos:mzpos@localhost:5432/mzpos?sslmode=disable"),
		JWTSecret:      getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpiryHours: getEnvInt("JWT_EXPIRY_HOURS", 24),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

package config

import (
	"errors"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// DefaultJWTSecret = nilai contoh; DILARANG dipakai di produksi.
const DefaultJWTSecret = "change-me-in-production"

// Config menampung seluruh konfigurasi aplikasi dari environment.
type Config struct {
	AppPort        string
	AppEnv         string
	DatabaseURL    string
	JWTSecret      string
	JWTExpiryHours int
	CORSOrigins    string // origin dipisah koma; kosong = izinkan semua (dev)
}

// Load membaca .env (jika ada) lalu mengisi Config dari environment.
// Nilai default dipakai bila variabel tidak diset.
func Load() *Config {
	// .env opsional — abaikan error bila tidak ada (mis. di produksi).
	_ = godotenv.Load()

	return &Config{
		AppPort:     getEnv("APP_PORT", "8080"),
		AppEnv:      getEnv("APP_ENV", "development"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://mzpos:mzpos@localhost:5432/mzpos?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", DefaultJWTSecret),
		// 12 jam: cukup untuk satu shift, perkecil jendela token basi (user
		// nonaktif/role berubah masih valid hingga kedaluwarsa).
		JWTExpiryHours: getEnvInt("JWT_EXPIRY_HOURS", 12),
		CORSOrigins:    getEnv("CORS_ORIGINS", ""),
	}
}

// Validate menolak konfigurasi tidak aman di produksi: secret default/lemah
// (token bisa dipalsukan) atau CORS terbuka penuh.
func (c *Config) Validate() error {
	if c.AppEnv != "production" {
		return nil
	}
	if c.JWTSecret == "" || c.JWTSecret == DefaultJWTSecret || len(c.JWTSecret) < 16 {
		return errors.New("JWT_SECRET wajib diatur (min. 16 karakter, bukan default) di produksi")
	}
	if strings.TrimSpace(c.CORSOrigins) == "" {
		return errors.New("CORS_ORIGINS wajib diatur di produksi (mis. https://app.contoh.com)")
	}
	return nil
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

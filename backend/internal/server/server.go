package server

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mzpos/backend/internal/auth"
	"github.com/mzpos/backend/internal/catalog"
	"github.com/mzpos/backend/internal/config"
)

// Server membungkus instance Fiber, konfigurasi, dan koneksi database.
type Server struct {
	App *fiber.App
	cfg *config.Config
	db  *pgxpool.Pool
}

// New membuat server Fiber dengan middleware dasar dan route terdaftar.
func New(cfg *config.Config, db *pgxpool.Pool) *Server {
	app := fiber.New(fiber.Config{
		AppName:      "MZ POS API",
		ErrorHandler: errorHandler,
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New())

	s := &Server{App: app, cfg: cfg, db: db}
	s.registerRoutes()
	return s
}

// Listen menjalankan server pada port terkonfigurasi.
func (s *Server) Listen() error {
	return s.App.Listen(":" + s.cfg.AppPort)
}

// registerRoutes mendaftarkan seluruh route. Modul lain (auth, catalog, dst)
// akan menambahkan group route-nya di sini seiring pengembangan.
func (s *Server) registerRoutes() {
	s.App.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
			"env":    s.cfg.AppEnv,
		})
	})

	api := s.App.Group("/api/v1")

	tokens := auth.NewTokenManager(s.cfg.JWTSecret, s.cfg.JWTExpiryHours)
	authRepo := auth.NewRepository(s.db)
	authHandler := auth.NewHandler(authRepo, tokens)
	authHandler.Register(api)

	// Endpoint contoh terproteksi: kembalikan identitas dari token.
	api.Get("/me", auth.RequireAuth(tokens), func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"user_id":  auth.UserID(c),
			"store_id": auth.StoreID(c),
			"role":     auth.Role(c),
		})
	})

	catalog.NewHandler(catalog.NewRepository(s.db), tokens).Register(api)
}

// errorHandler menyeragamkan format respons error.
func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{
		"error": err.Error(),
	})
}

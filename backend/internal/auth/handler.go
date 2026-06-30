package auth

import (
	"net/mail"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// dummyHash menyamakan waktu verifikasi saat email tak ada (cegah enumerasi
// lewat selisih waktu argon2). Dihitung sekali saat start.
var dummyHash, _ = HashPassword("timing-equalizer-bukan-password-asli")

// Handler menangani endpoint autentikasi.
type Handler struct {
	repo   *Repository
	tokens *TokenManager
}

func NewHandler(repo *Repository, tokens *TokenManager) *Handler {
	return &Handler{repo: repo, tokens: tokens}
}

// Register mendaftarkan route auth di group yang diberikan.
func (h *Handler) Register(r fiber.Router) {
	g := r.Group("/auth")
	g.Post("/register", h.loginRate(), h.register)
	g.Post("/login", h.loginRate(), h.login)

	// Manajemen toko & pengguna (multi-toko).
	h.registerManagement(r)
}

// loginRate membatasi percobaan login/register per IP (anti brute-force):
// maks 15 permintaan / menit. Mengembalikan 429 bila terlampaui.
func (h *Handler) loginRate() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        15,
		Expiration: time.Minute,
		LimitReached: func(c *fiber.Ctx) error {
			return fiber.NewError(fiber.StatusTooManyRequests, "terlalu banyak percobaan, coba lagi nanti")
		},
	})
}

type registerReq struct {
	StoreName string `json:"store_name"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

type authResp struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

// register membuat owner pertama (pemilik usaha) beserta toko pertamanya.
// Dibatasi: hanya boleh saat belum ada user sama sekali (bootstrap).
func (h *Handler) register(c *fiber.Ctx) error {
	var req registerReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" || req.Name == "" || req.StoreName == "" {
		return fiber.NewError(fiber.StatusBadRequest, "store_name, name, email, password wajib diisi")
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "format email tidak valid")
	}
	if len(req.Password) < 8 {
		return fiber.NewError(fiber.StatusBadRequest, "password minimal 8 karakter")
	}

	count, err := h.repo.CountUsers(c.Context())
	if err != nil {
		return err
	}
	if count > 0 {
		return fiber.NewError(fiber.StatusForbidden, "registrasi awal sudah dilakukan")
	}

	storeID, err := h.repo.CreateStore(c.Context(), req.StoreName)
	if err != nil {
		return err
	}

	hash, err := HashPassword(req.Password)
	if err != nil {
		return err
	}

	// User pertama = owner (pemilik usaha), yang lalu menyiapkan cabang & staf.
	user, err := h.repo.CreateUser(c.Context(), &User{
		StoreID:      storeID,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         "owner",
	})
	if err != nil {
		if err == ErrEmailTaken {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return err
	}

	return h.issueToken(c, user, fiber.StatusCreated)
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) login(c *fiber.Ctx) error {
	var req loginReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	user, err := h.repo.GetUserByEmail(c.Context(), req.Email)
	if err != nil {
		// Email tak ada: tetap jalankan verifikasi dummy agar waktu respons sama
		// (cegah enumerasi via timing). Pesan disamakan dgn password salah.
		_, _ = VerifyPassword(req.Password, dummyHash)
		return fiber.NewError(fiber.StatusUnauthorized, "email atau password salah")
	}
	if !user.IsActive {
		return fiber.NewError(fiber.StatusForbidden, "akun nonaktif")
	}

	ok, err := VerifyPassword(req.Password, user.PasswordHash)
	if err != nil || !ok {
		return fiber.NewError(fiber.StatusUnauthorized, "email atau password salah")
	}

	return h.issueToken(c, user, fiber.StatusOK)
}

func (h *Handler) issueToken(c *fiber.Ctx, user *User, status int) error {
	token, err := h.tokens.Generate(user.ID, user.StoreID, user.Role, time.Now())
	if err != nil {
		return err
	}
	return c.Status(status).JSON(authResp{Token: token, User: user})
}

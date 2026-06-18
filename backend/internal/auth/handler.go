package auth

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

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
	g.Post("/register", h.register)
	g.Post("/login", h.login)
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

// register membuat admin pertama beserta toko-nya.
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

	user, err := h.repo.CreateUser(c.Context(), &User{
		StoreID:      storeID,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         "admin",
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
		// Samakan pesan untuk email tidak ada vs password salah (cegah enumerasi).
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

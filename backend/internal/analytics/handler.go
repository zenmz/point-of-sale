package analytics

import (
	"github.com/gofiber/fiber/v2"

	"github.com/mzpos/backend/internal/auth"
)

type Handler struct {
	repo   *Repository
	tokens *auth.TokenManager
}

func NewHandler(repo *Repository, tokens *auth.TokenManager) *Handler {
	return &Handler{repo: repo, tokens: tokens}
}

// Register: dashboard analitik hanya admin/owner.
func (h *Handler) Register(r fiber.Router) {
	g := r.Group("/analytics", auth.RequireAuth(h.tokens), auth.RequireRole("admin", "owner"))
	g.Get("/dashboard", h.dashboard)
}

func (h *Handler) dashboard(c *fiber.Ctx) error {
	days := c.QueryInt("days", 14)
	if days < 1 || days > 365 {
		days = 14
	}
	d, err := h.repo.Dashboard(c.Context(), auth.StoreID(c), days)
	if err != nil {
		return err
	}
	return c.JSON(d)
}

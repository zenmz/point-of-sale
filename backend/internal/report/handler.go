package report

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/mzpos/backend/internal/auth"
)

const dateLayout = "2006-01-02"

type Handler struct {
	repo   *Repository
	tokens *auth.TokenManager
}

func NewHandler(repo *Repository, tokens *auth.TokenManager) *Handler {
	return &Handler{repo: repo, tokens: tokens}
}

// Register mendaftarkan route laporan. Hanya admin/owner.
func (h *Handler) Register(r fiber.Router) {
	rep := r.Group("/reports", auth.RequireAuth(h.tokens), auth.RequireRole("admin", "owner"))
	rep.Get("/sales", h.sales)
	rep.Get("/top-products", h.topProducts)
	rep.Get("/payment-methods", h.paymentMethods)
}

// dateRange membaca query from/to (YYYY-MM-DD) → [from, toExclusive).
// Default: hari ini. to inklusif (dikonversi jadi awal hari berikutnya).
func dateRange(c *fiber.Ctx) (time.Time, time.Time, error) {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)

	from := today
	if v := c.Query("from"); v != "" {
		t, err := time.ParseInLocation(dateLayout, v, time.Local)
		if err != nil {
			return from, from, fiber.NewError(fiber.StatusBadRequest, "format tanggal 'from' tidak valid")
		}
		from = t
	}

	to := today
	if v := c.Query("to"); v != "" {
		t, err := time.ParseInLocation(dateLayout, v, time.Local)
		if err != nil {
			return from, from, fiber.NewError(fiber.StatusBadRequest, "format tanggal 'to' tidak valid")
		}
		to = t
	}

	toExclusive := to.AddDate(0, 0, 1)
	if toExclusive.Before(from) {
		return from, from, fiber.NewError(fiber.StatusBadRequest, "rentang tanggal tidak valid")
	}
	return from, toExclusive, nil
}

func (h *Handler) sales(c *fiber.Ctx) error {
	from, to, err := dateRange(c)
	if err != nil {
		return err
	}
	rep, err := h.repo.Sales(c.Context(), auth.StoreID(c), from, to)
	if err != nil {
		return err
	}
	return c.JSON(rep)
}

func (h *Handler) topProducts(c *fiber.Ctx) error {
	from, to, err := dateRange(c)
	if err != nil {
		return err
	}
	limit := c.QueryInt("limit", 10)
	if limit < 1 || limit > 100 {
		limit = 10
	}
	items, err := h.repo.TopProducts(c.Context(), auth.StoreID(c), from, to, limit)
	if err != nil {
		return err
	}
	return c.JSON(items)
}

func (h *Handler) paymentMethods(c *fiber.Ctx) error {
	from, to, err := dateRange(c)
	if err != nil {
		return err
	}
	out, err := h.repo.PaymentMethods(c.Context(), auth.StoreID(c), from, to)
	if err != nil {
		return err
	}
	return c.JSON(out)
}

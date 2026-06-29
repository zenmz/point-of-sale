package transaction

import (
	"errors"

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

// Register mendaftarkan route transaksi. Semua butuh login (kasir/admin/owner).
func (h *Handler) Register(r fiber.Router) {
	authed := auth.RequireAuth(h.tokens)

	tx := r.Group("/transactions", authed)
	tx.Post("/", h.create)
	tx.Get("/:id", h.get)
}

type checkoutReq struct {
	Items          []ItemInput `json:"items"`
	Discount       int64       `json:"discount"`
	TaxPercent     float64     `json:"tax_percent"`
	ServicePercent float64     `json:"service_percent"`
	Method         Method      `json:"method"`
	PaidAmount     int64       `json:"paid_amount"`
}

func (h *Handler) create(c *fiber.Ctx) error {
	var req checkoutReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if len(req.Items) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "keranjang kosong")
	}

	t, err := h.repo.Create(c.Context(), CreateInput{
		StoreID:        auth.StoreID(c),
		CashierID:      auth.UserID(c),
		Items:          req.Items,
		Discount:       req.Discount,
		TaxPercent:     req.TaxPercent,
		ServicePercent: req.ServicePercent,
		Method:         req.Method,
		PaidAmount:     req.PaidAmount,
	})
	if err != nil {
		return mapErr(err)
	}
	return c.Status(fiber.StatusCreated).JSON(t)
}

func (h *Handler) get(c *fiber.Ctx) error {
	t, err := h.repo.Get(c.Context(), auth.StoreID(c), c.Params("id"))
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(t)
}

func mapErr(err error) error {
	var insufficient *InsufficientStockError
	switch {
	case errors.As(err, &insufficient):
		return fiber.NewError(fiber.StatusConflict, err.Error())
	case errors.Is(err, ErrEmpty), errors.Is(err, ErrInvalidMethod), errors.Is(err, ErrPaymentShort):
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	case errors.Is(err, ErrProductNotFound), errors.Is(err, ErrNotFound):
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	default:
		return err
	}
}

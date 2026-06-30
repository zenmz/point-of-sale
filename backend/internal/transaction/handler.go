package transaction

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"

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
	tx.Post("/quote", h.quote)
	tx.Get("/:id", h.get)
}

type quoteReq struct {
	Items          []ItemInput `json:"items"`
	Discount       int64       `json:"discount"`
	TaxPercent     float64     `json:"tax_percent"`
	ServicePercent float64     `json:"service_percent"`
}

// quote mengembalikan rincian total nota otoritatif (sama dgn checkout) tanpa
// menyimpan — dipakai kasir agar jumlah bayar persis sama dengan server.
func (h *Handler) quote(c *fiber.Ctx) error {
	var req quoteReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if len(req.Items) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "keranjang kosong")
	}
	t, err := h.repo.Quote(c.Context(), QuoteInput{
		StoreID:        auth.StoreID(c),
		Items:          req.Items,
		Discount:       req.Discount,
		TaxPercent:     req.TaxPercent,
		ServicePercent: req.ServicePercent,
	})
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(t)
}

type checkoutReq struct {
	Items          []ItemInput `json:"items"`
	Discount       int64       `json:"discount"`
	TaxPercent     float64     `json:"tax_percent"`
	ServicePercent float64     `json:"service_percent"`
	Method         Method      `json:"method"`
	PaidAmount     int64       `json:"paid_amount"`
	ClientID       string      `json:"client_id"`
	CustomerID     string      `json:"customer_id"`
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
		CustomerID:     req.CustomerID,
		Items:          req.Items,
		Discount:       req.Discount,
		TaxPercent:     req.TaxPercent,
		ServicePercent: req.ServicePercent,
		Method:         req.Method,
		PaidAmount:     req.PaidAmount,
		ClientID:       req.ClientID,
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
	// id (uuid) tak valid dari klien → 400, jangan bocorkan error SQL mentah.
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
		return fiber.NewError(fiber.StatusBadRequest, "id tidak valid")
	}
	switch {
	case errors.As(err, &insufficient):
		return fiber.NewError(fiber.StatusConflict, err.Error())
	case errors.Is(err, ErrEmpty), errors.Is(err, ErrInvalidMethod),
		errors.Is(err, ErrPaymentShort), errors.Is(err, ErrInvalidQty):
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	case errors.Is(err, ErrProductNotFound), errors.Is(err, ErrNotFound),
		errors.Is(err, ErrCustomerNotFound), errors.Is(err, ErrVariantNotFound):
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	default:
		return err
	}
}

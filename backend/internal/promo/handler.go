package promo

import (
	"errors"
	"strings"
	"time"

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

// Register: kelola promo butuh admin/owner; pratinjau (checkout) boleh semua.
func (h *Handler) Register(r fiber.Router) {
	authed := auth.RequireAuth(h.tokens)
	admin := auth.RequireRole("admin", "owner")

	g := r.Group("/promotions", authed)
	g.Get("/", h.list)
	g.Post("/preview", h.preview)
	g.Post("/", admin, h.create)
	g.Put("/:id", admin, h.update)
	g.Delete("/:id", admin, h.remove)
}

func (h *Handler) list(c *fiber.Ctx) error {
	out, err := h.repo.List(c.Context(), auth.StoreID(c))
	if err != nil {
		return err
	}
	return c.JSON(out)
}

type promoReq struct {
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Percent     float64 `json:"percent"`
	MinPurchase int64   `json:"min_purchase"`
	ProductID   *string `json:"product_id"`
	MinQty      int64   `json:"min_qty"`
	StartHour   *int    `json:"start_hour"`
	EndHour     *int    `json:"end_hour"`
	IsActive    *bool   `json:"is_active"`
}

func (req *promoReq) toModel(storeID string) (*Promotion, error) {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return nil, fiber.NewError(fiber.StatusBadRequest, "nama promo wajib diisi")
	}
	if req.Percent <= 0 || req.Percent > 100 {
		return nil, fiber.NewError(fiber.StatusBadRequest, "persen diskon harus 1..100")
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	p := &Promotion{
		StoreID: storeID, Name: req.Name, Type: req.Type, Percent: req.Percent,
		MinPurchase: req.MinPurchase, ProductID: req.ProductID, MinQty: req.MinQty,
		StartHour: req.StartHour, EndHour: req.EndHour, IsActive: active,
	}
	// Validasi spesifik per tipe.
	switch req.Type {
	case ProductQty:
		if req.ProductID == nil || *req.ProductID == "" || req.MinQty < 1 {
			return nil, fiber.NewError(fiber.StatusBadRequest, "promo produk butuh product_id & min_qty")
		}
	case HappyHour:
		if req.StartHour == nil || req.EndHour == nil ||
			*req.StartHour < 0 || *req.StartHour > 23 || *req.EndHour < 0 || *req.EndHour > 23 {
			return nil, fiber.NewError(fiber.StatusBadRequest, "happy hour butuh jam 0..23")
		}
	}
	return p, nil
}

func (h *Handler) create(c *fiber.Ctx) error {
	var req promoReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	p, err := req.toModel(auth.StoreID(c))
	if err != nil {
		return err
	}
	out, err := h.repo.Create(c.Context(), p)
	if err != nil {
		return mapErr(err)
	}
	return c.Status(fiber.StatusCreated).JSON(out)
}

func (h *Handler) update(c *fiber.Ctx) error {
	var req promoReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	p, err := req.toModel(auth.StoreID(c))
	if err != nil {
		return err
	}
	p.ID = c.Params("id")
	out, err := h.repo.Update(c.Context(), auth.StoreID(c), p)
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(out)
}

func (h *Handler) remove(c *fiber.Ctx) error {
	if err := h.repo.Delete(c.Context(), auth.StoreID(c), c.Params("id")); err != nil {
		return mapErr(err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

type previewReq struct {
	Items []PreviewItem `json:"items"`
}

func (h *Handler) preview(c *fiber.Ctx) error {
	var req previewReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	res, err := h.repo.Preview(c.Context(), auth.StoreID(c), req.Items, time.Now().Hour())
	if err != nil {
		return err
	}
	return c.JSON(res)
}

func mapErr(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	case errors.Is(err, ErrInvalidType):
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	default:
		return err
	}
}

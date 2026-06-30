package customer

import (
	"errors"
	"strings"

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

// Register: lihat/cari/daftar member boleh semua role (kasir butuh saat
// transaksi); ubah & penukaran poin butuh admin/owner.
func (h *Handler) Register(r fiber.Router) {
	authed := auth.RequireAuth(h.tokens)
	admin := auth.RequireRole("admin", "owner")

	g := r.Group("/customers", authed)
	g.Get("/", h.list)
	g.Get("/:id", h.detail)
	g.Post("/", h.create)
	g.Put("/:id", admin, h.update)
	g.Post("/:id/redeem", admin, h.redeem)
}

func (h *Handler) list(c *fiber.Ctx) error {
	out, err := h.repo.List(c.Context(), auth.StoreID(c), c.Query("search"))
	if err != nil {
		return err
	}
	return c.JSON(out)
}

func (h *Handler) detail(c *fiber.Ctx) error {
	d, err := h.repo.Detail(c.Context(), auth.StoreID(c), c.Params("id"))
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(d)
}

type customerReq struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
	Email *string `json:"email"`
}

func (req *customerReq) clean() error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama wajib diisi")
	}
	req.Phone = trimPtr(req.Phone)
	req.Email = trimPtr(req.Email)
	return nil
}

func (h *Handler) create(c *fiber.Ctx) error {
	var req customerReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if err := req.clean(); err != nil {
		return err
	}
	cust, err := h.repo.Create(c.Context(), &Customer{
		StoreID: auth.StoreID(c), Name: req.Name, Phone: req.Phone, Email: req.Email,
	})
	if err != nil {
		return mapErr(err)
	}
	return c.Status(fiber.StatusCreated).JSON(cust)
}

func (h *Handler) update(c *fiber.Ctx) error {
	var req customerReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if err := req.clean(); err != nil {
		return err
	}
	cust, err := h.repo.Update(c.Context(), auth.StoreID(c), c.Params("id"), req.Name, req.Phone, req.Email)
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(cust)
}

type redeemReq struct {
	Points int64   `json:"points"`
	Note   *string `json:"note"`
}

func (h *Handler) redeem(c *fiber.Ctx) error {
	var req redeemReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if req.Points <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "poin harus lebih dari nol")
	}
	cust, err := h.repo.Redeem(c.Context(), auth.StoreID(c), c.Params("id"), req.Points, trimPtr(req.Note))
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(cust)
}

func mapErr(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	case errors.Is(err, ErrPhoneTaken):
		return fiber.NewError(fiber.StatusConflict, err.Error())
	case errors.Is(err, ErrInsufficientPts):
		return fiber.NewError(fiber.StatusConflict, err.Error())
	default:
		return err
	}
}

// trimPtr memangkas string opsional; kosong → nil.
func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

package inventory

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

// Register mendaftarkan route stok. Lihat butuh login; ubah stok butuh admin/owner.
func (h *Handler) Register(r fiber.Router) {
	authed := auth.RequireAuth(h.tokens)
	admin := auth.RequireRole("admin", "owner")

	inv := r.Group("/inventory", authed)
	inv.Get("/", h.list)
	inv.Get("/:productID/movements", h.movements)
	inv.Post("/:productID/adjust", admin, h.adjust)
}

func (h *Handler) list(c *fiber.Ctx) error {
	items, err := h.repo.ListInventory(c.Context(), auth.StoreID(c), c.Query("search"))
	if err != nil {
		return err
	}
	return c.JSON(items)
}

func (h *Handler) movements(c *fiber.Ctx) error {
	moves, err := h.repo.ListMovements(c.Context(), auth.StoreID(c), c.Params("productID"))
	if err != nil {
		return err
	}
	return c.JSON(moves)
}

type adjustReq struct {
	Type   MovementType `json:"type"`
	Qty    int64        `json:"qty"`
	Reason *string      `json:"reason"`
}

func (h *Handler) adjust(c *fiber.Ctx) error {
	var req adjustReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if !req.Type.valid() {
		return fiber.NewError(fiber.StatusBadRequest, "jenis pergerakan tidak valid")
	}
	if req.Qty < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "jumlah tidak boleh negatif")
	}
	if (req.Type == Masuk || req.Type == Keluar) && req.Qty == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "jumlah harus lebih dari nol")
	}
	if req.Reason != nil {
		r := strings.TrimSpace(*req.Reason)
		if r == "" {
			req.Reason = nil
		} else {
			req.Reason = &r
		}
	}

	m, err := h.repo.Adjust(c.Context(), auth.StoreID(c), c.Params("productID"),
		auth.UserID(c), req.Type, req.Qty, req.Reason)
	if err != nil {
		return mapErr(err)
	}
	return c.Status(fiber.StatusCreated).JSON(m)
}

func mapErr(err error) error {
	switch {
	case errors.Is(err, ErrProductNotFound):
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	case errors.Is(err, ErrInsufficient):
		return fiber.NewError(fiber.StatusConflict, err.Error())
	default:
		return err
	}
}

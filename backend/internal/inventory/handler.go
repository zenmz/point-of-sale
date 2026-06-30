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

	owner := auth.RequireRole("owner")

	inv := r.Group("/inventory", authed)
	inv.Get("/", h.list)
	// Transfer antar cabang (owner) — daftar dulu agar tak bentrok dgn :productID.
	inv.Get("/transfers", owner, h.listTransfers)
	inv.Post("/transfer", owner, h.transfer)
	inv.Post("/opname", admin, h.opname)
	inv.Get("/:productID/movements", h.movements)
	inv.Post("/:productID/adjust", admin, h.adjust)
}

type transferReq struct {
	ToStoreID string  `json:"to_store_id"`
	ProductID string  `json:"product_id"`
	Qty       int64   `json:"qty"`
	Note      *string `json:"note"`
}

func (h *Handler) transfer(c *fiber.Ctx) error {
	var req transferReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if req.ToStoreID == "" || req.ProductID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "cabang tujuan & produk wajib diisi")
	}
	if req.Qty <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "jumlah harus lebih dari nol")
	}
	if req.Note != nil {
		n := strings.TrimSpace(*req.Note)
		if n == "" {
			req.Note = nil
		} else {
			req.Note = &n
		}
	}
	t, err := h.repo.TransferStock(c.Context(), auth.StoreID(c), req.ToStoreID,
		req.ProductID, auth.UserID(c), req.Qty, req.Note)
	if err != nil {
		return mapErr(err)
	}
	return c.Status(fiber.StatusCreated).JSON(t)
}

func (h *Handler) listTransfers(c *fiber.Ctx) error {
	out, err := h.repo.ListTransfers(c.Context(), auth.StoreID(c))
	if err != nil {
		return err
	}
	return c.JSON(out)
}

type opnameReq struct {
	Items []OpnameItem `json:"items"`
}

func (h *Handler) opname(c *fiber.Ctx) error {
	var req opnameReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if len(req.Items) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "tidak ada item opname")
	}
	out, err := h.repo.Opname(c.Context(), auth.StoreID(c), auth.UserID(c), req.Items)
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(out)
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
	case errors.Is(err, ErrProductNotFound), errors.Is(err, ErrStoreNotFound),
		errors.Is(err, ErrDestProductNotFound):
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	case errors.Is(err, ErrInsufficient):
		return fiber.NewError(fiber.StatusConflict, err.Error())
	case errors.Is(err, ErrSameStore):
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	default:
		return err
	}
}

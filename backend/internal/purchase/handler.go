package purchase

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

// Register: pembelian = fungsi manajemen (admin/owner).
func (h *Handler) Register(r fiber.Router) {
	authed := auth.RequireAuth(h.tokens)
	admin := auth.RequireRole("admin", "owner")

	sup := r.Group("/suppliers", authed, admin)
	sup.Get("/", h.listSuppliers)
	sup.Post("/", h.createSupplier)
	sup.Put("/:id", h.updateSupplier)

	po := r.Group("/purchase-orders", authed, admin)
	po.Get("/", h.listPOs)
	po.Get("/debt", h.debt)
	po.Get("/:id", h.getPO)
	po.Post("/", h.createPO)
	po.Post("/:id/receive", h.receivePO)
	po.Post("/:id/pay", h.payPO)
	po.Post("/:id/cancel", h.cancelPO)
}

// ---- Pemasok ----

func (h *Handler) listSuppliers(c *fiber.Ctx) error {
	out, err := h.repo.ListSuppliers(c.Context(), auth.StoreID(c), c.Query("search"))
	if err != nil {
		return err
	}
	return c.JSON(out)
}

type supplierReq struct {
	Name    string  `json:"name"`
	Phone   *string `json:"phone"`
	Email   *string `json:"email"`
	Address *string `json:"address"`
}

func (req *supplierReq) clean() error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama pemasok wajib diisi")
	}
	req.Phone = trimPtr(req.Phone)
	req.Email = trimPtr(req.Email)
	req.Address = trimPtr(req.Address)
	return nil
}

func (h *Handler) createSupplier(c *fiber.Ctx) error {
	var req supplierReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if err := req.clean(); err != nil {
		return err
	}
	s, err := h.repo.CreateSupplier(c.Context(), &Supplier{
		StoreID: auth.StoreID(c), Name: req.Name, Phone: req.Phone, Email: req.Email, Address: req.Address,
	})
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(s)
}

func (h *Handler) updateSupplier(c *fiber.Ctx) error {
	var req supplierReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if err := req.clean(); err != nil {
		return err
	}
	s, err := h.repo.UpdateSupplier(c.Context(), auth.StoreID(c), c.Params("id"),
		req.Name, req.Phone, req.Email, req.Address)
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(s)
}

// ---- PO ----

func (h *Handler) listPOs(c *fiber.Ctx) error {
	out, err := h.repo.ListPOs(c.Context(), auth.StoreID(c))
	if err != nil {
		return err
	}
	return c.JSON(out)
}

func (h *Handler) getPO(c *fiber.Ctx) error {
	p, err := h.repo.GetPO(c.Context(), auth.StoreID(c), c.Params("id"))
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(p)
}

type createPOReq struct {
	SupplierID string      `json:"supplier_id"`
	Note       string      `json:"note"`
	Items      []ItemInput `json:"items"`
}

func (h *Handler) createPO(c *fiber.Ctx) error {
	var req createPOReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if len(req.Items) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "PO harus punya minimal 1 item")
	}
	p, err := h.repo.CreatePO(c.Context(), CreateInput{
		StoreID:    auth.StoreID(c),
		SupplierID: req.SupplierID,
		CreatedBy:  auth.UserID(c),
		Note:       strings.TrimSpace(req.Note),
		Items:      req.Items,
	})
	if err != nil {
		return mapErr(err)
	}
	return c.Status(fiber.StatusCreated).JSON(p)
}

func (h *Handler) receivePO(c *fiber.Ctx) error {
	p, err := h.repo.ReceivePO(c.Context(), auth.StoreID(c), c.Params("id"), auth.UserID(c))
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(p)
}

func (h *Handler) payPO(c *fiber.Ctx) error {
	p, err := h.repo.PayPO(c.Context(), auth.StoreID(c), c.Params("id"))
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(p)
}

func (h *Handler) cancelPO(c *fiber.Ctx) error {
	p, err := h.repo.CancelPO(c.Context(), auth.StoreID(c), c.Params("id"))
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(p)
}

func (h *Handler) debt(c *fiber.Ctx) error {
	total, count, err := h.repo.Debt(c.Context(), auth.StoreID(c))
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"total": total, "count": count})
}

func mapErr(err error) error {
	switch {
	case errors.Is(err, ErrSupplierNotFound), errors.Is(err, ErrPONotFound),
		errors.Is(err, ErrProductNotFound):
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	case errors.Is(err, ErrEmpty), errors.Is(err, ErrNotOrdered), errors.Is(err, ErrAlreadyPaid),
		errors.Is(err, ErrNotReceived), errors.Is(err, ErrInvalidItem):
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	default:
		return err
	}
}

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

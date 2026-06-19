package catalog

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

// Register mendaftarkan route catalog. Semua butuh login; mutasi butuh admin.
func (h *Handler) Register(r fiber.Router) {
	authed := auth.RequireAuth(h.tokens)
	admin := auth.RequireRole("admin", "owner")

	cat := r.Group("/categories", authed)
	cat.Get("/", h.listCategories)
	cat.Post("/", admin, h.createCategory)
	cat.Put("/:id", admin, h.updateCategory)
	cat.Delete("/:id", admin, h.deleteCategory)

	prod := r.Group("/products", authed)
	prod.Get("/", h.listProducts)
	prod.Get("/:id", h.getProduct)
	prod.Post("/", admin, h.createProduct)
	prod.Put("/:id", admin, h.updateProduct)
	prod.Delete("/:id", admin, h.deleteProduct)
}

// ---- Kategori ----

func (h *Handler) listCategories(c *fiber.Ctx) error {
	cats, err := h.repo.ListCategories(c.Context(), auth.StoreID(c))
	if err != nil {
		return err
	}
	return c.JSON(cats)
}

type categoryReq struct {
	Name string `json:"name"`
}

func (h *Handler) createCategory(c *fiber.Ctx) error {
	var req categoryReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama kategori wajib diisi")
	}
	cat, err := h.repo.CreateCategory(c.Context(), auth.StoreID(c), req.Name)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(cat)
}

func (h *Handler) updateCategory(c *fiber.Ctx) error {
	var req categoryReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama kategori wajib diisi")
	}
	cat, err := h.repo.UpdateCategory(c.Context(), auth.StoreID(c), c.Params("id"), req.Name)
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(cat)
}

func (h *Handler) deleteCategory(c *fiber.Ctx) error {
	if err := h.repo.DeleteCategory(c.Context(), auth.StoreID(c), c.Params("id")); err != nil {
		return mapErr(err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ---- Produk ----

func (h *Handler) listProducts(c *fiber.Ctx) error {
	products, err := h.repo.ListProducts(c.Context(), auth.StoreID(c), c.Query("search"))
	if err != nil {
		return err
	}
	return c.JSON(products)
}

func (h *Handler) getProduct(c *fiber.Ctx) error {
	p, err := h.repo.GetProduct(c.Context(), auth.StoreID(c), c.Params("id"))
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(p)
}

type variantReq struct {
	Name  string  `json:"name"`
	SKU   *string `json:"sku"`
	Price *int64  `json:"price"`
}

type productReq struct {
	CategoryID *string      `json:"category_id"`
	Name       string       `json:"name"`
	SKU        *string      `json:"sku"`
	Barcode    *string      `json:"barcode"`
	Price      int64        `json:"price"`
	Variants   []variantReq `json:"variants"`
}

func (req *productReq) validate() error {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama produk wajib diisi")
	}
	if req.Price < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "harga tidak boleh negatif")
	}
	return nil
}

func (req *productReq) toVariants() []Variant {
	out := make([]Variant, 0, len(req.Variants))
	for _, v := range req.Variants {
		name := strings.TrimSpace(v.Name)
		if name == "" {
			continue
		}
		out = append(out, Variant{Name: name, SKU: v.SKU, Price: v.Price})
	}
	return out
}

func (h *Handler) createProduct(c *fiber.Ctx) error {
	var req productReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if err := req.validate(); err != nil {
		return err
	}

	p, err := h.repo.CreateProduct(c.Context(), &Product{
		StoreID:    auth.StoreID(c),
		CategoryID: req.CategoryID,
		Name:       req.Name,
		SKU:        req.SKU,
		Barcode:    req.Barcode,
		Price:      req.Price,
	})
	if err != nil {
		return mapErr(err)
	}

	if vs := req.toVariants(); len(vs) > 0 {
		if err := h.repo.ReplaceVariants(c.Context(), p.ID, vs); err != nil {
			return err
		}
		p.Variants = vs
	}
	return c.Status(fiber.StatusCreated).JSON(p)
}

func (h *Handler) updateProduct(c *fiber.Ctx) error {
	var req productReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if err := req.validate(); err != nil {
		return err
	}

	p, err := h.repo.UpdateProduct(c.Context(), &Product{
		ID:         c.Params("id"),
		StoreID:    auth.StoreID(c),
		CategoryID: req.CategoryID,
		Name:       req.Name,
		SKU:        req.SKU,
		Barcode:    req.Barcode,
		Price:      req.Price,
	})
	if err != nil {
		return mapErr(err)
	}

	if err := h.repo.ReplaceVariants(c.Context(), p.ID, req.toVariants()); err != nil {
		return err
	}
	return c.JSON(h.reload(c, p.ID))
}

func (h *Handler) deleteProduct(c *fiber.Ctx) error {
	if err := h.repo.DeleteProduct(c.Context(), auth.StoreID(c), c.Params("id")); err != nil {
		return mapErr(err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// reload mengambil ulang produk lengkap (dengan varian) untuk respons.
func (h *Handler) reload(c *fiber.Ctx, id string) *Product {
	p, err := h.repo.GetProduct(c.Context(), auth.StoreID(c), id)
	if err != nil {
		return &Product{ID: id}
	}
	return p
}

// mapErr menerjemahkan error repo ke kode HTTP.
func mapErr(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	case errors.Is(err, ErrDuplicate):
		return fiber.NewError(fiber.StatusConflict, err.Error())
	default:
		return err
	}
}

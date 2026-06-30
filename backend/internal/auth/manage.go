package auth

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// registerManagement mendaftarkan route manajemen toko & pengguna (multi-toko).
// Owner: lintas cabang. Admin: hanya cabang sendiri. Kasir: tak boleh.
func (h *Handler) registerManagement(r fiber.Router) {
	authed := RequireAuth(h.tokens)
	owner := RequireRole("owner")
	manager := RequireRole("owner", "admin")

	st := r.Group("/stores", authed)
	st.Get("/", h.listStores)
	st.Post("/", owner, h.createStore)
	st.Patch("/:id", owner, h.updateStore)
	st.Post("/:id/switch", owner, h.switchStore)

	us := r.Group("/users", authed, manager)
	us.Get("/", h.listUsers)
	us.Post("/", h.createManagedUser)
	us.Patch("/:id", h.updateManagedUser)
}

// ---- Toko ----

// listStores: owner melihat semua cabang; selain owner hanya cabangnya sendiri.
func (h *Handler) listStores(c *fiber.Ctx) error {
	if Role(c) == "owner" {
		stores, err := h.repo.ListStores(c.Context())
		if err != nil {
			return err
		}
		return c.JSON(stores)
	}
	s, err := h.repo.GetStore(c.Context(), StoreID(c))
	if err != nil {
		return mapManageErr(err)
	}
	return c.JSON([]Store{*s})
}

type storeReq struct {
	Name            string  `json:"name"`
	Address         *string `json:"address"`
	Phone           *string `json:"phone"`
	IsActive        *bool   `json:"is_active"`
	CopyCatalogFrom *string `json:"copy_catalog_from"` // hanya saat create
}

func (h *Handler) createStore(c *fiber.Ctx) error {
	var req storeReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama toko wajib diisi")
	}

	s, err := h.repo.CreateStoreFull(c.Context(), &Store{
		Name:    req.Name,
		Address: req.Address,
		Phone:   req.Phone,
	})
	if err != nil {
		return err
	}

	// Katalog bersama: salin produk/kategori dari toko sumber bila diminta.
	if req.CopyCatalogFrom != nil && *req.CopyCatalogFrom != "" {
		if err := h.repo.CopyCatalog(c.Context(), *req.CopyCatalogFrom, s.ID); err != nil {
			return err
		}
	}
	return c.Status(fiber.StatusCreated).JSON(s)
}

func (h *Handler) updateStore(c *fiber.Ctx) error {
	var req storeReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama toko wajib diisi")
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	s, err := h.repo.UpdateStore(c.Context(), &Store{
		ID:       c.Params("id"),
		Name:     req.Name,
		Address:  req.Address,
		Phone:    req.Phone,
		IsActive: active,
	})
	if err != nil {
		return mapManageErr(err)
	}
	return c.JSON(s)
}

// switchStore menerbitkan ulang JWT untuk owner agar berkonteks ke cabang lain.
// Semua scoping data per toko otomatis mengikuti store_id token yang baru.
func (h *Handler) switchStore(c *fiber.Ctx) error {
	target := c.Params("id")
	store, err := h.repo.GetStore(c.Context(), target)
	if err != nil {
		return mapManageErr(err)
	}
	if !store.IsActive {
		return fiber.NewError(fiber.StatusBadRequest, "toko nonaktif")
	}

	user, err := h.repo.GetUserByID(c.Context(), UserID(c))
	if err != nil {
		return mapManageErr(err)
	}
	// Konteks cabang aktif = toko tujuan (store_id asli user tak berubah di DB).
	user.StoreID = target

	token, err := h.tokens.Generate(user.ID, target, user.Role, time.Now())
	if err != nil {
		return err
	}
	return c.JSON(authResp{Token: token, User: user})
}

// ---- Pengguna ----

// listUsers: owner bisa filter ?store_id= (atau semua); admin dipaksa cabangnya.
func (h *Handler) listUsers(c *fiber.Ctx) error {
	var scope *string
	if Role(c) == "owner" {
		if q := c.Query("store_id"); q != "" {
			scope = &q
		}
	} else {
		s := StoreID(c)
		scope = &s
	}
	users, err := h.repo.ListUsers(c.Context(), scope)
	if err != nil {
		return err
	}
	return c.JSON(users)
}

type manageUserReq struct {
	StoreID  string `json:"store_id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
	IsActive *bool  `json:"is_active"`
}

var validRoles = map[string]bool{"owner": true, "admin": true, "kasir": true}

// authorizeTarget memastikan pemanggil berhak atas cabang & role target.
// Owner: bebas. Admin: terbatas pada cabangnya & tak boleh menyentuh role owner.
func authorizeTarget(callerRole, callerStore, targetStore, targetRole string) error {
	if callerRole == "owner" {
		return nil
	}
	if targetStore != callerStore {
		return fiber.NewError(fiber.StatusForbidden, "tak boleh kelola cabang lain")
	}
	if targetRole == "owner" {
		return fiber.NewError(fiber.StatusForbidden, "hanya owner boleh menetapkan role owner")
	}
	return nil
}

func (h *Handler) createManagedUser(c *fiber.Ctx) error {
	var req manageUserReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Role == "" {
		req.Role = "kasir"
	}
	// Admin default membuat user di cabangnya sendiri.
	if req.StoreID == "" {
		req.StoreID = StoreID(c)
	}
	if req.Name == "" || req.Email == "" {
		return fiber.NewError(fiber.StatusBadRequest, "nama & email wajib diisi")
	}
	if len(req.Password) < 8 {
		return fiber.NewError(fiber.StatusBadRequest, "password minimal 8 karakter")
	}
	if !validRoles[req.Role] {
		return fiber.NewError(fiber.StatusBadRequest, "role tidak valid")
	}
	if err := authorizeTarget(Role(c), StoreID(c), req.StoreID, req.Role); err != nil {
		return err
	}
	// Pastikan toko tujuan ada (owner bisa kirim store_id apa saja) → 404, bukan 500.
	if _, err := h.repo.GetStore(c.Context(), req.StoreID); err != nil {
		return mapManageErr(err)
	}

	hash, err := HashPassword(req.Password)
	if err != nil {
		return err
	}
	user, err := h.repo.CreateUser(c.Context(), &User{
		StoreID:      req.StoreID,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         req.Role,
	})
	if err != nil {
		if err == ErrEmailTaken {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(user)
}

func (h *Handler) updateManagedUser(c *fiber.Ctx) error {
	var req manageUserReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}

	// Ambil user target untuk cek cabang asalnya.
	target, err := h.repo.GetUserByID(c.Context(), c.Params("id"))
	if err != nil {
		return mapManageErr(err)
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		req.Name = target.Name
	}
	if req.Role == "" {
		req.Role = target.Role
	}
	if !validRoles[req.Role] {
		return fiber.NewError(fiber.StatusBadRequest, "role tidak valid")
	}
	// Cek hak atas cabang asal user maupun role baru.
	if err := authorizeTarget(Role(c), StoreID(c), target.StoreID, target.Role); err != nil {
		return err
	}
	if err := authorizeTarget(Role(c), StoreID(c), target.StoreID, req.Role); err != nil {
		return err
	}

	active := target.IsActive
	if req.IsActive != nil {
		active = *req.IsActive
	}
	// Cegah owner/admin menonaktifkan dirinya sendiri (terkunci dari sistem).
	if !active && target.ID == UserID(c) {
		return fiber.NewError(fiber.StatusBadRequest, "tidak bisa menonaktifkan akun sendiri")
	}

	var hash *string
	if req.Password != "" {
		if len(req.Password) < 8 {
			return fiber.NewError(fiber.StatusBadRequest, "password minimal 8 karakter")
		}
		hp, err := HashPassword(req.Password)
		if err != nil {
			return err
		}
		hash = &hp
	}

	user, err := h.repo.UpdateUser(c.Context(), target.ID, req.Name, req.Role, active, hash)
	if err != nil {
		if err == ErrEmailTaken {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return mapManageErr(err)
	}
	return c.JSON(user)
}

func mapManageErr(err error) error {
	switch err {
	case ErrStoreNotFound, ErrUserNotFound:
		return fiber.NewError(fiber.StatusNotFound, err.Error())
	default:
		return err
	}
}

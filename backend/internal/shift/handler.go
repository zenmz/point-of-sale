package shift

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

// Register mendaftarkan route shift. Semua butuh login.
func (h *Handler) Register(r fiber.Router) {
	authed := auth.RequireAuth(h.tokens)

	s := r.Group("/shifts", authed)
	s.Get("/current", h.current)
	s.Post("/open", h.open)
	s.Post("/close", h.close)
}

// current: 200 dengan shift terbuka, atau 204 bila tidak ada.
func (h *Handler) current(c *fiber.Ctx) error {
	s, err := h.repo.Current(c.Context(), auth.StoreID(c), auth.UserID(c))
	if errors.Is(err, ErrNoOpenShift) {
		return c.SendStatus(fiber.StatusNoContent)
	}
	if err != nil {
		return err
	}
	return c.JSON(s)
}

type openReq struct {
	OpeningCash int64   `json:"opening_cash"`
	Note        *string `json:"note"`
}

func (h *Handler) open(c *fiber.Ctx) error {
	var req openReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if req.OpeningCash < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "kas awal tidak boleh negatif")
	}
	s, err := h.repo.Open(c.Context(), auth.StoreID(c), auth.UserID(c), req.OpeningCash, trimNote(req.Note))
	if err != nil {
		return mapErr(err)
	}
	return c.Status(fiber.StatusCreated).JSON(s)
}

type closeReq struct {
	ClosingCash int64   `json:"closing_cash"`
	Note        *string `json:"note"`
}

func (h *Handler) close(c *fiber.Ctx) error {
	var req closeReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "body tidak valid")
	}
	if req.ClosingCash < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "kas akhir tidak boleh negatif")
	}
	s, err := h.repo.Close(c.Context(), auth.StoreID(c), auth.UserID(c), req.ClosingCash, trimNote(req.Note))
	if err != nil {
		return mapErr(err)
	}
	return c.JSON(s)
}

func trimNote(n *string) *string {
	if n == nil {
		return nil
	}
	t := strings.TrimSpace(*n)
	if t == "" {
		return nil
	}
	return &t
}

func mapErr(err error) error {
	switch {
	case errors.Is(err, ErrAlreadyOpen):
		return fiber.NewError(fiber.StatusConflict, err.Error())
	case errors.Is(err, ErrNoOpenShift):
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	default:
		return err
	}
}

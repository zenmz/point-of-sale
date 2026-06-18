package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// Konteks key untuk menyimpan klaim user di fiber.Ctx.Locals.
const (
	ctxUserID  = "userID"
	ctxStoreID = "storeID"
	ctxRole    = "role"
)

// RequireAuth memverifikasi JWT dari header Authorization: Bearer <token>.
func RequireAuth(tokens *TokenManager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			return fiber.NewError(fiber.StatusUnauthorized, "token tidak ada")
		}
		raw := strings.TrimPrefix(header, "Bearer ")

		claims, err := tokens.Parse(raw)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "token tidak valid")
		}

		c.Locals(ctxUserID, claims.UserID)
		c.Locals(ctxStoreID, claims.StoreID)
		c.Locals(ctxRole, claims.Role)
		return c.Next()
	}
}

// RequireRole membatasi akses ke role tertentu. Pakai setelah RequireAuth.
func RequireRole(roles ...string) fiber.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *fiber.Ctx) error {
		role, _ := c.Locals(ctxRole).(string)
		if _, ok := allowed[role]; !ok {
			return fiber.NewError(fiber.StatusForbidden, "akses ditolak")
		}
		return c.Next()
	}
}

// Helper untuk membaca identitas user dari context di handler lain.
func UserID(c *fiber.Ctx) string  { v, _ := c.Locals(ctxUserID).(string); return v }
func StoreID(c *fiber.Ctx) string { v, _ := c.Locals(ctxStoreID).(string); return v }
func Role(c *fiber.Ctx) string    { v, _ := c.Locals(ctxRole).(string); return v }

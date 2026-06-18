package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("token tidak valid")

// Claims adalah payload JWT MZ POS.
type Claims struct {
	UserID  string `json:"uid"`
	StoreID string `json:"sid"`
	Role    string `json:"role"`
	jwt.RegisteredClaims
}

// TokenManager menerbitkan dan memverifikasi JWT.
type TokenManager struct {
	secret      []byte
	expiryHours int
}

func NewTokenManager(secret string, expiryHours int) *TokenManager {
	return &TokenManager{secret: []byte(secret), expiryHours: expiryHours}
}

// Generate menerbitkan token untuk user. issuedAt diberikan dari pemanggil
// agar mudah diuji dan tidak bergantung langsung pada clock global.
func (m *TokenManager) Generate(userID, storeID, role string, issuedAt time.Time) (string, error) {
	claims := Claims{
		UserID:  userID,
		StoreID: storeID,
		Role:    role,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(issuedAt),
			ExpiresAt: jwt.NewNumericDate(issuedAt.Add(time.Duration(m.expiryHours) * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// Parse memverifikasi tanda tangan dan mengembalikan claims.
func (m *TokenManager) Parse(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secret, nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

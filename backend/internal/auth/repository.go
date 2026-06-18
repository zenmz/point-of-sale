package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound = errors.New("user tidak ditemukan")
	ErrEmailTaken   = errors.New("email sudah terdaftar")
)

// User merepresentasikan baris tabel users.
type User struct {
	ID           string    `json:"id"`
	StoreID      string    `json:"store_id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

// Repository mengakses data store & user.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// CountUsers mengembalikan jumlah user (dipakai untuk menentukan apakah ini
// registrasi admin pertama).
func (r *Repository) CountUsers(ctx context.Context) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	return n, err
}

// CreateStore membuat toko baru dan mengembalikan id-nya.
func (r *Repository) CreateStore(ctx context.Context, name string) (string, error) {
	var id string
	err := r.db.QueryRow(ctx,
		`INSERT INTO stores (name) VALUES ($1) RETURNING id`, name).Scan(&id)
	return id, err
}

// CreateUser menyisipkan user baru. Mengembalikan ErrEmailTaken bila email duplikat.
func (r *Repository) CreateUser(ctx context.Context, u *User) (*User, error) {
	err := r.db.QueryRow(ctx, `
		INSERT INTO users (store_id, name, email, password_hash, role)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, is_active, created_at`,
		u.StoreID, u.Name, u.Email, u.PasswordHash, u.Role,
	).Scan(&u.ID, &u.IsActive, &u.CreatedAt)

	if err != nil {
		// 23505 = unique_violation (email).
		if pgErr := pgErrorCode(err); pgErr == "23505" {
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return u, nil
}

// GetUserByEmail mengambil user berdasar email (untuk login).
func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(ctx, `
		SELECT id, store_id, name, email, password_hash, role, is_active, created_at
		FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.StoreID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.IsActive, &u.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

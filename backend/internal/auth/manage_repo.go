package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ErrStoreNotFound dikembalikan saat toko tidak ada.
var ErrStoreNotFound = errors.New("toko tidak ditemukan")

// Store merepresentasikan baris tabel stores (cabang).
type Store struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Address   *string   `json:"address"`
	Phone     *string   `json:"phone"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// ---- Toko / cabang ----

// ListStores mengembalikan semua toko (urut nama). Dipakai owner untuk switcher.
func (r *Repository) ListStores(ctx context.Context) ([]Store, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, name, address, phone, is_active, created_at FROM stores ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stores := []Store{}
	for rows.Next() {
		var s Store
		if err := rows.Scan(&s.ID, &s.Name, &s.Address, &s.Phone, &s.IsActive, &s.CreatedAt); err != nil {
			return nil, err
		}
		stores = append(stores, s)
	}
	return stores, rows.Err()
}

// GetStore mengambil satu toko berdasar id.
func (r *Repository) GetStore(ctx context.Context, id string) (*Store, error) {
	s := &Store{}
	err := r.db.QueryRow(ctx,
		`SELECT id, name, address, phone, is_active, created_at FROM stores WHERE id = $1`, id,
	).Scan(&s.ID, &s.Name, &s.Address, &s.Phone, &s.IsActive, &s.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrStoreNotFound
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

// CreateStore menyisipkan toko baru (nama + alamat + telp opsional).
func (r *Repository) CreateStoreFull(ctx context.Context, s *Store) (*Store, error) {
	err := r.db.QueryRow(ctx,
		`INSERT INTO stores (name, address, phone) VALUES ($1, $2, $3)
		 RETURNING id, is_active, created_at`,
		s.Name, s.Address, s.Phone,
	).Scan(&s.ID, &s.IsActive, &s.CreatedAt)
	return s, err
}

// UpdateStore memutakhirkan data toko.
func (r *Repository) UpdateStore(ctx context.Context, s *Store) (*Store, error) {
	err := r.db.QueryRow(ctx,
		`UPDATE stores SET name = $2, address = $3, phone = $4, is_active = $5, updated_at = now()
		 WHERE id = $1
		 RETURNING id, name, address, phone, is_active, created_at`,
		s.ID, s.Name, s.Address, s.Phone, s.IsActive,
	).Scan(&s.ID, &s.Name, &s.Address, &s.Phone, &s.IsActive, &s.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrStoreNotFound
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

// CopyCatalog menyalin kategori, produk, dan varian dari satu toko ke toko lain
// (katalog bersama sebagai titik awal). Stok TIDAK ikut disalin — tiap cabang
// punya stok sendiri.
func (r *Repository) CopyCatalog(ctx context.Context, fromStore, toStore string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Kategori: simpan pemetaan id lama → id baru untuk remap product.category_id.
	rows, err := tx.Query(ctx, `SELECT id, name FROM categories WHERE store_id = $1`, fromStore)
	if err != nil {
		return err
	}
	type cat struct{ id, name string }
	var cats []cat
	for rows.Next() {
		var c cat
		if err := rows.Scan(&c.id, &c.name); err != nil {
			rows.Close()
			return err
		}
		cats = append(cats, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	catMap := make(map[string]string, len(cats))
	for _, c := range cats {
		var newID string
		if err := tx.QueryRow(ctx,
			`INSERT INTO categories (store_id, name) VALUES ($1, $2) RETURNING id`,
			toStore, c.name,
		).Scan(&newID); err != nil {
			return err
		}
		catMap[c.id] = newID
	}

	// Produk + varian.
	prows, err := tx.Query(ctx,
		`SELECT id, category_id, name, sku, barcode, price, cost FROM products
		 WHERE store_id = $1 AND is_active = TRUE`, fromStore)
	if err != nil {
		return err
	}
	type prod struct {
		id, name     string
		categoryID   *string
		sku, barcode *string
		price        int64
		cost         int64
	}
	var prods []prod
	for prows.Next() {
		var p prod
		if err := prows.Scan(&p.id, &p.categoryID, &p.name, &p.sku, &p.barcode, &p.price, &p.cost); err != nil {
			prows.Close()
			return err
		}
		prods = append(prods, p)
	}
	prows.Close()
	if err := prows.Err(); err != nil {
		return err
	}

	for _, p := range prods {
		var newCat *string
		if p.categoryID != nil {
			if mapped, ok := catMap[*p.categoryID]; ok {
				newCat = &mapped
			}
		}
		var newID string
		if err := tx.QueryRow(ctx,
			`INSERT INTO products (store_id, category_id, name, sku, barcode, price, cost)
			 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
			toStore, newCat, p.name, p.sku, p.barcode, p.price, p.cost,
		).Scan(&newID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO variants (product_id, name, sku, price)
			 SELECT $1, name, sku, price FROM variants WHERE product_id = $2`,
			newID, p.id,
		); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// ---- Pengguna ----

// ListUsers mengembalikan user; bila storeID != nil, hanya milik toko itu.
func (r *Repository) ListUsers(ctx context.Context, storeID *string) ([]User, error) {
	q := `SELECT id, store_id, name, email, role, is_active, created_at FROM users`
	args := []any{}
	if storeID != nil {
		q += ` WHERE store_id = $1`
		args = append(args, *storeID)
	}
	q += ` ORDER BY created_at`

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []User{}
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.StoreID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// GetUserByID mengambil user (tanpa hash) berdasar id.
func (r *Repository) GetUserByID(ctx context.Context, id string) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(ctx,
		`SELECT id, store_id, name, email, role, is_active, created_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.StoreID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// UpdateUser memutakhirkan nama/role/aktif (dan password bila passwordHash != nil).
func (r *Repository) UpdateUser(ctx context.Context, id, name, role string, isActive bool, passwordHash *string) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(ctx, `
		UPDATE users SET
			name = $2,
			role = $3,
			is_active = $4,
			password_hash = COALESCE($5, password_hash),
			updated_at = now()
		WHERE id = $1
		RETURNING id, store_id, name, email, role, is_active, created_at`,
		id, name, role, isActive, passwordHash,
	).Scan(&u.ID, &u.StoreID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		if pgErrorCode(err) == "23505" {
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return u, nil
}

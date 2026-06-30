package customer

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound        = errors.New("member tidak ditemukan")
	ErrPhoneTaken      = errors.New("nomor telepon sudah terdaftar")
	ErrInsufficientPts = errors.New("poin tidak mencukupi")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// List mengembalikan member toko (opsional filter nama/telepon).
func (r *Repository) List(ctx context.Context, storeID, search string) ([]Customer, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, store_id, name, phone, email, points, created_at
		 FROM customers
		 WHERE store_id = $1
		   AND ($2 = '' OR name ILIKE '%'||$2||'%' OR phone ILIKE '%'||$2||'%')
		 ORDER BY name LIMIT 100`, storeID, search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Customer{}
	for rows.Next() {
		var c Customer
		if err := rows.Scan(&c.ID, &c.StoreID, &c.Name, &c.Phone, &c.Email, &c.Points, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Repository) get(ctx context.Context, storeID, id string) (*Customer, error) {
	c := &Customer{}
	err := r.db.QueryRow(ctx,
		`SELECT id, store_id, name, phone, email, points, created_at
		 FROM customers WHERE id = $1 AND store_id = $2`, id, storeID).
		Scan(&c.ID, &c.StoreID, &c.Name, &c.Phone, &c.Email, &c.Points, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

// Detail mengembalikan member + riwayat poin + riwayat beli.
func (r *Repository) Detail(ctx context.Context, storeID, id string) (*Detail, error) {
	c, err := r.get(ctx, storeID, id)
	if err != nil {
		return nil, err
	}
	d := &Detail{Customer: *c, Loyalty: []LoyaltyEntry{}, Purchases: []Purchase{}}

	lr, err := r.db.Query(ctx,
		`SELECT id, type, points, balance_after, note, created_at
		 FROM loyalty_points WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`, id)
	if err != nil {
		return nil, err
	}
	defer lr.Close()
	for lr.Next() {
		var e LoyaltyEntry
		if err := lr.Scan(&e.ID, &e.Type, &e.Points, &e.BalanceAfter, &e.Note, &e.CreatedAt); err != nil {
			return nil, err
		}
		d.Loyalty = append(d.Loyalty, e)
	}
	if err := lr.Err(); err != nil {
		return nil, err
	}

	pr, err := r.db.Query(ctx,
		`SELECT id, number, total, points_earned, created_at
		 FROM transactions WHERE customer_id = $1 AND status = 'selesai'
		 ORDER BY created_at DESC LIMIT 50`, id)
	if err != nil {
		return nil, err
	}
	defer pr.Close()
	for pr.Next() {
		var p Purchase
		if err := pr.Scan(&p.ID, &p.Number, &p.Total, &p.PointsEarned, &p.CreatedAt); err != nil {
			return nil, err
		}
		d.Purchases = append(d.Purchases, p)
	}
	return d, pr.Err()
}

// Create menyisipkan member baru.
func (r *Repository) Create(ctx context.Context, c *Customer) (*Customer, error) {
	err := r.db.QueryRow(ctx,
		`INSERT INTO customers (store_id, name, phone, email)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, points, created_at`,
		c.StoreID, c.Name, c.Phone, c.Email).Scan(&c.ID, &c.Points, &c.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrPhoneTaken
		}
		return nil, err
	}
	return c, nil
}

// Update memutakhirkan data member (bukan poin).
func (r *Repository) Update(ctx context.Context, storeID, id, name string, phone, email *string) (*Customer, error) {
	c := &Customer{}
	err := r.db.QueryRow(ctx,
		`UPDATE customers SET name = $3, phone = $4, email = $5, updated_at = now()
		 WHERE id = $1 AND store_id = $2
		 RETURNING id, store_id, name, phone, email, points, created_at`,
		id, storeID, name, phone, email).
		Scan(&c.ID, &c.StoreID, &c.Name, &c.Phone, &c.Email, &c.Points, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrPhoneTaken
		}
		return nil, err
	}
	return c, nil
}

// Redeem menukar poin member (kurangi saldo + catat buku besar). Wajib cukup.
func (r *Repository) Redeem(ctx context.Context, storeID, id string, points int64, note *string) (*Customer, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var balance int64
	err = tx.QueryRow(ctx,
		`SELECT points FROM customers WHERE id = $1 AND store_id = $2 FOR UPDATE`,
		id, storeID).Scan(&balance)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if points <= 0 || points > balance {
		return nil, ErrInsufficientPts
	}

	newBal := balance - points
	if _, err := tx.Exec(ctx, `UPDATE customers SET points = $2, updated_at = now() WHERE id = $1`,
		id, newBal); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO loyalty_points (customer_id, type, points, balance_after, note)
		 VALUES ($1, 'redeem', $2, $3, $4)`,
		id, -points, newBal, note); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.get(ctx, storeID, id)
}

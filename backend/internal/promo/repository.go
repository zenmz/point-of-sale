package promo

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound    = errors.New("promo tidak ditemukan")
	ErrInvalidType = errors.New("jenis promo tidak valid")
)

// Querier dipenuhi oleh *pgxpool.Pool maupun pgx.Tx — agar QueryActive bisa
// dipakai di luar maupun di dalam transaksi checkout.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// QueryActive mengambil promo aktif satu toko sebagai aturan engine.
func QueryActive(ctx context.Context, q Querier, storeID string) ([]Promo, error) {
	rows, err := q.Query(ctx,
		`SELECT id, name, type, percent, min_purchase, product_id, min_qty, start_hour, end_hour
		 FROM promotions WHERE store_id = $1 AND is_active = TRUE`, storeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Promo{}
	for rows.Next() {
		var p Promo
		if err := rows.Scan(&p.ID, &p.Name, &p.Type, &p.Percent, &p.MinBuy,
			&p.ProductID, &p.MinQty, &p.StartHour, &p.EndHour); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func validType(t string) bool {
	return t == NotaPercent || t == ProductQty || t == HappyHour
}

func (r *Repository) List(ctx context.Context, storeID string) ([]Promotion, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, store_id, name, type, percent, min_purchase, product_id, min_qty,
		        start_hour, end_hour, is_active, created_at
		 FROM promotions WHERE store_id = $1 ORDER BY created_at DESC`, storeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Promotion{}
	for rows.Next() {
		var p Promotion
		if err := rows.Scan(&p.ID, &p.StoreID, &p.Name, &p.Type, &p.Percent, &p.MinPurchase,
			&p.ProductID, &p.MinQty, &p.StartHour, &p.EndHour, &p.IsActive, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) Create(ctx context.Context, p *Promotion) (*Promotion, error) {
	if !validType(p.Type) {
		return nil, ErrInvalidType
	}
	err := r.db.QueryRow(ctx,
		`INSERT INTO promotions
		 (store_id, name, type, percent, min_purchase, product_id, min_qty, start_hour, end_hour, is_active)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id, created_at`,
		p.StoreID, p.Name, p.Type, p.Percent, p.MinPurchase, p.ProductID, p.MinQty,
		p.StartHour, p.EndHour, p.IsActive).Scan(&p.ID, &p.CreatedAt)
	return p, err
}

func (r *Repository) Update(ctx context.Context, storeID string, p *Promotion) (*Promotion, error) {
	if !validType(p.Type) {
		return nil, ErrInvalidType
	}
	err := r.db.QueryRow(ctx,
		`UPDATE promotions SET name=$3, type=$4, percent=$5, min_purchase=$6, product_id=$7,
		        min_qty=$8, start_hour=$9, end_hour=$10, is_active=$11, updated_at=now()
		 WHERE id=$1 AND store_id=$2
		 RETURNING id, store_id, name, type, percent, min_purchase, product_id, min_qty,
		           start_hour, end_hour, is_active, created_at`,
		p.ID, storeID, p.Name, p.Type, p.Percent, p.MinPurchase, p.ProductID, p.MinQty,
		p.StartHour, p.EndHour, p.IsActive).
		Scan(&p.ID, &p.StoreID, &p.Name, &p.Type, &p.Percent, &p.MinPurchase, &p.ProductID,
			&p.MinQty, &p.StartHour, &p.EndHour, &p.IsActive, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return p, err
}

func (r *Repository) Delete(ctx context.Context, storeID, id string) error {
	ct, err := r.db.Exec(ctx, `DELETE FROM promotions WHERE id=$1 AND store_id=$2`, id, storeID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// PreviewItem = item untuk pratinjau promo (qty per produk).
type PreviewItem struct {
	ProductID string `json:"product_id"`
	Qty       int64  `json:"qty"`
}

// Preview menghitung diskon promo untuk keranjang (tanpa menyimpan). Harga
// diambil dari produk aktif toko; hour ditentukan pemanggil.
func (r *Repository) Preview(ctx context.Context, storeID string, items []PreviewItem, hour int) (Result, error) {
	lines := make([]Line, 0, len(items))
	var subtotal int64
	for _, it := range items {
		if it.Qty <= 0 {
			continue
		}
		var price int64
		err := r.db.QueryRow(ctx,
			`SELECT price FROM products WHERE id=$1 AND store_id=$2 AND is_active=TRUE`,
			it.ProductID, storeID).Scan(&price)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return Result{}, err
		}
		lt := price * it.Qty
		subtotal += lt
		lines = append(lines, Line{ProductID: it.ProductID, Qty: it.Qty, LineTotal: lt})
	}
	promos, err := QueryActive(ctx, r.db, storeID)
	if err != nil {
		return Result{}, err
	}
	return Compute(lines, subtotal, hour, promos), nil
}

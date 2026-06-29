package report

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// Sales mengembalikan ringkasan + rincian harian pada [from, to) (to eksklusif).
func (r *Repository) Sales(ctx context.Context, storeID string, from, to time.Time) (*SalesReport, error) {
	var s SalesSummary
	err := r.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(total),0), COUNT(*), COALESCE(SUM(discount),0), COALESCE(SUM(tax),0)
		 FROM transactions
		 WHERE store_id = $1 AND status = 'selesai' AND created_at >= $2 AND created_at < $3`,
		storeID, from, to).Scan(&s.TotalSales, &s.TxCount, &s.TotalDiscount, &s.TotalTax)
	if err != nil {
		return nil, err
	}
	if s.TxCount > 0 {
		s.AvgSale = s.TotalSales / s.TxCount
	}

	rows, err := r.db.Query(ctx,
		`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d,
		        COUNT(*), COALESCE(SUM(total),0)
		 FROM transactions
		 WHERE store_id = $1 AND status = 'selesai' AND created_at >= $2 AND created_at < $3
		 GROUP BY d ORDER BY d`,
		storeID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	daily := []DailySales{}
	for rows.Next() {
		var d DailySales
		if err := rows.Scan(&d.Date, &d.TxCount, &d.Total); err != nil {
			return nil, err
		}
		daily = append(daily, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &SalesReport{Summary: s, Daily: daily}, nil
}

// TopProducts mengembalikan produk terlaris (qty terbanyak) pada rentang.
func (r *Repository) TopProducts(ctx context.Context, storeID string, from, to time.Time, limit int) ([]TopProduct, error) {
	rows, err := r.db.Query(ctx,
		`SELECT ti.product_id, ti.name, SUM(ti.qty), SUM(ti.line_total)
		 FROM transaction_items ti
		 JOIN transactions t ON t.id = ti.transaction_id
		 WHERE t.store_id = $1 AND t.status = 'selesai' AND t.created_at >= $2 AND t.created_at < $3
		 GROUP BY ti.product_id, ti.name
		 ORDER BY SUM(ti.qty) DESC, SUM(ti.line_total) DESC
		 LIMIT $4`,
		storeID, from, to, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []TopProduct{}
	for rows.Next() {
		var p TopProduct
		if err := rows.Scan(&p.ProductID, &p.Name, &p.QtySold, &p.Total); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

// PaymentMethods mengembalikan ringkasan per metode bayar (nilai bersih).
func (r *Repository) PaymentMethods(ctx context.Context, storeID string, from, to time.Time) ([]PaymentBreakdown, error) {
	rows, err := r.db.Query(ctx,
		`SELECT p.method, COUNT(*), COALESCE(SUM(p.amount - p.change_amount),0)
		 FROM payments p
		 JOIN transactions t ON t.id = p.transaction_id
		 WHERE t.store_id = $1 AND t.status = 'selesai' AND t.created_at >= $2 AND t.created_at < $3
		 GROUP BY p.method
		 ORDER BY SUM(p.amount - p.change_amount) DESC`,
		storeID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []PaymentBreakdown{}
	for rows.Next() {
		var b PaymentBreakdown
		if err := rows.Scan(&b.Method, &b.Count, &b.Total); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

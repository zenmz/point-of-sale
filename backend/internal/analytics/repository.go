package analytics

import (
	"context"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

// LowStockThreshold: produk dianggap perlu perhatian bila stok <= ini ATAU
// diprediksi habis < PredictDays hari.
const (
	LowStockThreshold = 5
	PredictDays       = 7
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// Dashboard merangkai tren penjualan, margin, dan prediksi stok untuk `days`
// hari terakhir pada satu toko.
func (r *Repository) Dashboard(ctx context.Context, storeID string, days int) (*Dashboard, error) {
	d := &Dashboard{Days: days, SalesTrend: []TrendPoint{}, LowStock: []StockAlert{}}

	// Tren penjualan harian.
	rows, err := r.db.Query(ctx,
		`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD'), COALESCE(SUM(total),0)
		 FROM transactions
		 WHERE store_id = $1 AND status = 'selesai'
		   AND created_at >= now() - make_interval(days => $2)
		 GROUP BY 1 ORDER BY 1`, storeID, days)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var t TrendPoint
		if err := rows.Scan(&t.Date, &t.Total); err != nil {
			rows.Close()
			return nil, err
		}
		d.SalesTrend = append(d.SalesTrend, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Margin = revenue (line_total kotor) − cost (harga modal × qty terjual).
	if err := r.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(ti.line_total),0), COALESCE(SUM(p.cost * ti.qty),0)
		 FROM transaction_items ti
		 JOIN transactions t ON t.id = ti.transaction_id
		 LEFT JOIN products p ON p.id = ti.product_id
		 WHERE t.store_id = $1 AND t.status = 'selesai'
		   AND t.created_at >= now() - make_interval(days => $2)`,
		storeID, days).Scan(&d.Margin.Revenue, &d.Margin.Cost); err != nil {
		return nil, err
	}
	d.Margin.Profit = d.Margin.Revenue - d.Margin.Cost
	if d.Margin.Revenue > 0 {
		d.Margin.MarginPct = float64(d.Margin.Profit) / float64(d.Margin.Revenue) * 100
	}

	// Prediksi stok: kecepatan jual (qty/hari) → perkiraan hari tersisa.
	srows, err := r.db.Query(ctx,
		`SELECT p.id, p.name, COALESCE(i.quantity,0), COALESCE(s.sold,0)
		 FROM products p
		 LEFT JOIN inventory i ON i.product_id = p.id
		 LEFT JOIN (
		     SELECT ti.product_id, SUM(ti.qty) AS sold
		     FROM transaction_items ti
		     JOIN transactions t ON t.id = ti.transaction_id
		     WHERE t.store_id = $1 AND t.status = 'selesai'
		       AND t.created_at >= now() - make_interval(days => $2)
		     GROUP BY ti.product_id
		 ) s ON s.product_id = p.id
		 WHERE p.store_id = $1 AND p.is_active = TRUE`, storeID, days)
	if err != nil {
		return nil, err
	}
	defer srows.Close()

	for srows.Next() {
		var id, name string
		var qty, sold int64
		if err := srows.Scan(&id, &name, &qty, &sold); err != nil {
			return nil, err
		}
		avg := float64(sold) / float64(days)
		a := StockAlert{ProductID: id, Name: name, Quantity: qty, AvgDaily: avg}
		var daysLeft float64 = -1
		if avg > 0 {
			daysLeft = float64(qty) / avg
			a.DaysLeft = &daysLeft
		}
		// Perlu perhatian bila stok rendah atau diprediksi habis cepat.
		if qty <= LowStockThreshold || (avg > 0 && daysLeft < PredictDays) {
			d.LowStock = append(d.LowStock, a)
		}
	}
	if err := srows.Err(); err != nil {
		return nil, err
	}

	// Urut paling mendesak dulu: yang punya prediksi (days_left) lebih kecil.
	sort.SliceStable(d.LowStock, func(i, j int) bool {
		a, b := d.LowStock[i], d.LowStock[j]
		ai := a.DaysLeft != nil
		bi := b.DaysLeft != nil
		if ai && bi {
			return *a.DaysLeft < *b.DaysLeft
		}
		if ai != bi {
			return ai // yang ada prediksi didahulukan
		}
		return a.Quantity < b.Quantity
	})
	if len(d.LowStock) > 20 {
		d.LowStock = d.LowStock[:20]
	}
	return d, nil
}

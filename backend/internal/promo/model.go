package promo

import "time"

// Promotion = baris lengkap tabel promotions (untuk CRUD).
type Promotion struct {
	ID          string    `json:"id"`
	StoreID     string    `json:"store_id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Percent     float64   `json:"percent"`
	MinPurchase int64     `json:"min_purchase"`
	ProductID   *string   `json:"product_id"`
	MinQty      int64     `json:"min_qty"`
	StartHour   *int      `json:"start_hour"`
	EndHour     *int      `json:"end_hour"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

package transaction

import "time"

type Status string

const (
	StatusSelesai Status = "selesai"
	StatusBatal   Status = "batal"
)

// Item = satu baris nota (snapshot nama & harga produk).
type Item struct {
	ID        string  `json:"id"`
	ProductID *string `json:"product_id"`
	Name      string  `json:"name"`
	Price     int64   `json:"price"`
	Qty       int64   `json:"qty"`
	Discount  int64   `json:"discount"`
	LineTotal int64   `json:"line_total"`
}

// Transaction = nota penjualan beserta rincian item.
type Transaction struct {
	ID             string    `json:"id"`
	StoreID        string    `json:"store_id"`
	CashierID      *string   `json:"cashier_id"`
	CashierName    *string   `json:"cashier_name"`
	Number         int64     `json:"number"`
	Subtotal       int64     `json:"subtotal"`
	Discount       int64     `json:"discount"`
	TaxPercent     float64   `json:"tax_percent"`
	Tax            int64     `json:"tax"`
	ServicePercent float64   `json:"service_percent"`
	ServiceCharge  int64     `json:"service_charge"`
	Total          int64     `json:"total"`
	Status         Status    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	Items          []Item    `json:"items"`
}

// ItemInput = item yang dikirim klien saat checkout.
type ItemInput struct {
	ProductID string `json:"product_id"`
	Qty       int64  `json:"qty"`
	Discount  int64  `json:"discount"`
}

// CreateInput = payload checkout. Diskon/persen di-recompute di server agar
// total tidak bisa dimanipulasi klien.
type CreateInput struct {
	StoreID        string
	CashierID      string
	Items          []ItemInput
	Discount       int64
	TaxPercent     float64
	ServicePercent float64
}

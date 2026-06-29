package catalog

import "time"

type Category struct {
	ID        string    `json:"id"`
	StoreID   string    `json:"store_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Variant struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	Name      string    `json:"name"`
	SKU       *string   `json:"sku"`
	Price     *int64    `json:"price"` // null = pakai harga produk
	CreatedAt time.Time `json:"created_at"`
}

type Product struct {
	ID         string    `json:"id"`
	StoreID    string    `json:"store_id"`
	CategoryID *string   `json:"category_id"`
	Name       string    `json:"name"`
	SKU        *string   `json:"sku"`
	Barcode    *string   `json:"barcode"`
	Price      int64     `json:"price"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	Variants   []Variant `json:"variants,omitempty"`
	// VariantCount diisi pada daftar produk (list) tanpa memuat seluruh varian.
	VariantCount int `json:"variant_count"`
	// Stock diisi pada daftar produk (list) dari tabel inventory (0 bila belum diatur).
	Stock int64 `json:"stock"`
}

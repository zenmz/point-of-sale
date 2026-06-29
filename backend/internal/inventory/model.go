package inventory

import "time"

// MovementType jenis pergerakan stok (selaras dengan enum stock_movement_type).
type MovementType string

const (
	Masuk       MovementType = "masuk"       // barang masuk (tambah qty)
	Keluar      MovementType = "keluar"      // barang keluar (kurangi qty)
	Penyesuaian MovementType = "penyesuaian" // set stok ke nilai absolut
)

func (t MovementType) valid() bool {
	switch t {
	case Masuk, Keluar, Penyesuaian:
		return true
	default:
		return false
	}
}

// Item = stok satu produk beserta info produk untuk ditampilkan di daftar stok.
type Item struct {
	ProductID string    `json:"product_id"`
	Name      string    `json:"name"`
	SKU       *string   `json:"sku"`
	Quantity  int64     `json:"quantity"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Movement = satu baris audit trail pergerakan stok.
type Movement struct {
	ID        string       `json:"id"`
	ProductID string       `json:"product_id"`
	Type      MovementType `json:"type"`
	Delta     int64        `json:"delta"`
	QtyAfter  int64        `json:"qty_after"`
	Reason    *string      `json:"reason"`
	UserName  *string      `json:"user_name"`
	CreatedAt time.Time    `json:"created_at"`
}

package purchase

import "time"

// Supplier = pemasok barang per toko.
type Supplier struct {
	ID        string    `json:"id"`
	StoreID   string    `json:"store_id"`
	Name      string    `json:"name"`
	Phone     *string   `json:"phone"`
	Email     *string   `json:"email"`
	Address   *string   `json:"address"`
	CreatedAt time.Time `json:"created_at"`
}

// POItem = baris item pesanan pembelian.
type POItem struct {
	ID        string  `json:"id"`
	ProductID *string `json:"product_id"`
	Name      string  `json:"name"`
	Qty       int64   `json:"qty"`
	Cost      int64   `json:"cost"`     // harga beli per unit
	Subtotal  int64   `json:"subtotal"` // qty * cost
}

// PO = pesanan pembelian beserta item.
type PO struct {
	ID           string     `json:"id"`
	StoreID      string     `json:"store_id"`
	SupplierID   *string    `json:"supplier_id"`
	SupplierName *string    `json:"supplier_name"`
	Number       int64      `json:"number"`
	Status       string     `json:"status"` // dipesan | diterima | batal
	Total        int64      `json:"total"`
	IsPaid       bool       `json:"is_paid"`
	Note         *string    `json:"note"`
	CreatedAt    time.Time  `json:"created_at"`
	ReceivedAt   *time.Time `json:"received_at"`
	Items        []POItem   `json:"items,omitempty"`
}

// ItemInput = item PO dari klien (cost = harga beli per unit).
type ItemInput struct {
	ProductID string `json:"product_id"`
	Qty       int64  `json:"qty"`
	Cost      int64  `json:"cost"`
}

// CreateInput = payload buat PO.
type CreateInput struct {
	StoreID    string
	SupplierID string
	CreatedBy  string
	Note       string
	Items      []ItemInput
}

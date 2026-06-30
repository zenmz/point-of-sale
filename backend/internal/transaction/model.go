package transaction

import "time"

type Status string

const (
	StatusSelesai Status = "selesai"
	StatusBatal   Status = "batal"
)

// Method = metode pembayaran (selaras enum payment_method).
type Method string

const (
	Tunai    Method = "tunai"
	QRIS     Method = "qris"
	EWallet  Method = "ewallet"
	Transfer Method = "transfer"
)

func (m Method) valid() bool {
	switch m {
	case Tunai, QRIS, EWallet, Transfer:
		return true
	default:
		return false
	}
}

// Payment = pembayaran satu nota.
type Payment struct {
	Method Method `json:"method"`
	Amount int64  `json:"amount"`
	Change int64  `json:"change"`
}

// Item = satu baris nota (snapshot nama & harga produk).
type Item struct {
	ID        string  `json:"id"`
	ProductID *string `json:"product_id"`
	VariantID *string `json:"variant_id"`
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
	StoreName      string    `json:"store_name"`
	StoreAddress   *string   `json:"store_address"`
	StorePhone     *string   `json:"store_phone"`
	CashierID      *string   `json:"cashier_id"`
	CashierName    *string   `json:"cashier_name"`
	CustomerID     *string   `json:"customer_id"`
	CustomerName   *string   `json:"customer_name"`
	PointsEarned   int64     `json:"points_earned"`
	Number         int64     `json:"number"`
	Subtotal       int64     `json:"subtotal"`
	Discount       int64     `json:"discount"`
	PromoDiscount  int64     `json:"promo_discount"`
	TaxPercent     float64   `json:"tax_percent"`
	Tax            int64     `json:"tax"`
	ServicePercent float64   `json:"service_percent"`
	ServiceCharge  int64     `json:"service_charge"`
	Total          int64     `json:"total"`
	Status         Status    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	Items          []Item    `json:"items"`
	Payment        *Payment  `json:"payment"`
}

// ItemInput = item yang dikirim klien saat checkout.
type ItemInput struct {
	ProductID string `json:"product_id"`
	VariantID string `json:"variant_id"` // opsional; harga varian override harga produk
	Qty       int64  `json:"qty"`
	Discount  int64  `json:"discount"`
}

// CreateInput = payload checkout. Diskon/persen di-recompute di server agar
// total tidak bisa dimanipulasi klien.
type CreateInput struct {
	StoreID        string
	CashierID      string
	CustomerID     string // member opsional; kosong = non-member
	Items          []ItemInput
	Discount       int64
	TaxPercent     float64
	ServicePercent float64
	Method         Method
	PaidAmount     int64  // jumlah dibayar (>= total)
	ClientID       string // UUID idempotensi (transaksi offline); kosong = online biasa
}

// QuoteInput = payload pratinjau total nota (tanpa pembayaran/member/stok).
type QuoteInput struct {
	StoreID        string
	Items          []ItemInput
	Discount       int64
	TaxPercent     float64
	ServicePercent float64
}

// PointsPerRupiah: 1 poin tiap Rp1.000 belanja (dari total nota).
// ponytail: rasio tetap; jadikan konfigurasi per-toko bila bisnis memintanya.
const RupiahPerPoint = 1000

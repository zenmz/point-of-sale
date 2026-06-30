package customer

import "time"

// Customer = member toko beserta saldo poin.
type Customer struct {
	ID        string    `json:"id"`
	StoreID   string    `json:"store_id"`
	Name      string    `json:"name"`
	Phone     *string   `json:"phone"`
	Email     *string   `json:"email"`
	Points    int64     `json:"points"`
	CreatedAt time.Time `json:"created_at"`
}

// LoyaltyEntry = satu baris buku besar poin.
type LoyaltyEntry struct {
	ID           string    `json:"id"`
	Type         string    `json:"type"` // earn | redeem | adjust
	Points       int64     `json:"points"`
	BalanceAfter int64     `json:"balance_after"`
	Note         *string   `json:"note"`
	CreatedAt    time.Time `json:"created_at"`
}

// Purchase = ringkasan satu nota milik member (riwayat beli).
type Purchase struct {
	ID           string    `json:"id"`
	Number       int64     `json:"number"`
	Total        int64     `json:"total"`
	PointsEarned int64     `json:"points_earned"`
	CreatedAt    time.Time `json:"created_at"`
}

// Detail = member + riwayat poin + riwayat beli.
type Detail struct {
	Customer
	Loyalty   []LoyaltyEntry `json:"loyalty"`
	Purchases []Purchase     `json:"purchases"`
}

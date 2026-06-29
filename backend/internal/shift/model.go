package shift

import "time"

type Status string

const (
	Buka  Status = "buka"
	Tutup Status = "tutup"
)

// Summary = rekap penjualan selama rentang shift (kasir ybs).
type Summary struct {
	TxCount      int64 `json:"tx_count"`
	CashSales    int64 `json:"cash_sales"`    // tunai bersih masuk laci (total - kembalian)
	NonCashSales int64 `json:"noncash_sales"` // qris/ewallet/transfer
	TotalSales   int64 `json:"total_sales"`
	ExpectedCash int64 `json:"expected_cash"` // kas awal + tunai
	Difference   int64 `json:"difference"`    // kas akhir - ekspektasi (0 bila belum tutup)
}

type Shift struct {
	ID          string     `json:"id"`
	StoreID     string     `json:"store_id"`
	UserID      string     `json:"user_id"`
	UserName    *string    `json:"user_name"`
	OpeningCash int64      `json:"opening_cash"`
	ClosingCash *int64     `json:"closing_cash"`
	Status      Status     `json:"status"`
	Note        *string    `json:"note"`
	OpenedAt    time.Time  `json:"opened_at"`
	ClosedAt    *time.Time `json:"closed_at"`
	Summary     *Summary   `json:"summary,omitempty"`
}

package analytics

// TrendPoint = total penjualan satu hari.
type TrendPoint struct {
	Date  string `json:"date"`
	Total int64  `json:"total"`
}

// Margin = ringkasan laba kotor (revenue − cost) pada rentang.
type Margin struct {
	Revenue   int64   `json:"revenue"`
	Cost      int64   `json:"cost"`
	Profit    int64   `json:"profit"`
	MarginPct float64 `json:"margin_pct"`
}

// StockAlert = prediksi habis stok satu produk.
type StockAlert struct {
	ProductID string   `json:"product_id"`
	Name      string   `json:"name"`
	Quantity  int64    `json:"quantity"`
	AvgDaily  float64  `json:"avg_daily"` // rata-rata terjual per hari
	DaysLeft  *float64 `json:"days_left"` // null bila tak ada penjualan (tak terprediksi)
}

// Dashboard = data analitik gabungan.
type Dashboard struct {
	Days       int          `json:"days"`
	SalesTrend []TrendPoint `json:"sales_trend"`
	Margin     Margin       `json:"margin"`
	LowStock   []StockAlert `json:"low_stock"`
}

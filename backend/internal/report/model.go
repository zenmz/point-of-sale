package report

// SalesSummary = ringkasan penjualan satu rentang tanggal.
type SalesSummary struct {
	TotalSales    int64 `json:"total_sales"`
	TxCount       int64 `json:"tx_count"`
	TotalDiscount int64 `json:"total_discount"`
	TotalTax      int64 `json:"total_tax"`
	AvgSale       int64 `json:"avg_sale"`
}

// DailySales = total penjualan per hari.
type DailySales struct {
	Date    string `json:"date"` // YYYY-MM-DD
	TxCount int64  `json:"tx_count"`
	Total   int64  `json:"total"`
}

type SalesReport struct {
	Summary SalesSummary `json:"summary"`
	Daily   []DailySales `json:"daily"`
}

// TopProduct = produk terlaris (berdasar qty terjual).
type TopProduct struct {
	ProductID *string `json:"product_id"`
	Name      string  `json:"name"`
	QtySold   int64   `json:"qty_sold"`
	Total     int64   `json:"total"`
}

// PaymentBreakdown = ringkasan per metode bayar.
type PaymentBreakdown struct {
	Method string `json:"method"`
	Count  int64  `json:"count"`
	Total  int64  `json:"total"`
}

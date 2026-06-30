// Package promo berisi engine perhitungan diskon promosi yang diterapkan
// otomatis saat checkout. Compute adalah fungsi murni (mudah diuji).
package promo

import "math"

// Tipe promo.
const (
	NotaPercent = "nota_percent" // diskon % nota bila belanja >= min_purchase
	ProductQty  = "product_qty"  // diskon % pada produk tertentu bila qty >= min_qty
	HappyHour   = "happy_hour"   // diskon % nota bila jam dalam [start_hour, end_hour)
)

// Promo = aturan promo aktif (subset kolom tabel promotions).
type Promo struct {
	ID        string
	Name      string
	Type      string
	Percent   float64
	MinBuy    int64
	ProductID *string
	MinQty    int64
	StartHour *int
	EndHour   *int
}

// Line = satu baris keranjang setelah diskon item (line total final).
type Line struct {
	ProductID string
	Qty       int64
	LineTotal int64
}

// Result = total diskon promo + nama promo yang terpakai.
type Result struct {
	Discount int64    `json:"discount"`
	Applied  []string `json:"applied"`
}

func pct(amount int64, percent float64) int64 {
	return int64(math.Round(float64(amount) * percent / 100))
}

// inWindow benar bila hour ada di [start, end). Mendukung lewat tengah malam
// (mis. 22→2) dengan membungkus rentang.
func inWindow(hour, start, end int) bool {
	if start == end {
		return false
	}
	if start < end {
		return hour >= start && hour < end
	}
	return hour >= start || hour < end // melewati tengah malam
}

// Compute menghitung total diskon promo untuk satu nota.
//   - product_qty: diskon per-baris bila qty >= min_qty (boleh menumpuk antar produk).
//   - nota_percent & happy_hour: diskon level nota; diambil SATU yang terbesar
//     (tidak menumpuk antar promo level-nota) agar diskon tak berlipat.
//
// subtotal = jumlah LineTotal semua baris (sesudah diskon item). hour = 0..23.
// Total diskon dibatasi maksimal subtotal.
func Compute(lines []Line, subtotal int64, hour int, promos []Promo) Result {
	var lineDisc int64
	var bestNota int64
	applied := []string{}
	productNames := map[string]bool{}

	for _, p := range promos {
		if p.Percent <= 0 {
			continue
		}
		switch p.Type {
		case ProductQty:
			if p.ProductID == nil {
				continue
			}
			for _, l := range lines {
				if l.ProductID == *p.ProductID && l.Qty >= p.MinQty {
					d := pct(l.LineTotal, p.Percent)
					if d > 0 {
						lineDisc += d
						if !productNames[p.ID] {
							applied = append(applied, p.Name)
							productNames[p.ID] = true
						}
					}
				}
			}
		case NotaPercent:
			if subtotal >= p.MinBuy {
				if d := pct(subtotal, p.Percent); d > bestNota {
					bestNota = d
				}
			}
		case HappyHour:
			if p.StartHour != nil && p.EndHour != nil && inWindow(hour, *p.StartHour, *p.EndHour) {
				if d := pct(subtotal, p.Percent); d > bestNota {
					bestNota = d
				}
			}
		}
	}

	// Catat nama promo nota-level terbesar yang dipilih.
	if bestNota > 0 {
		applied = append(applied, bestNotaName(subtotal, hour, promos, bestNota))
	}

	total := min(lineDisc+bestNota, subtotal)
	return Result{Discount: total, Applied: applied}
}

// bestNotaName mencari nama promo level-nota yang menghasilkan diskon == want.
func bestNotaName(subtotal int64, hour int, promos []Promo, want int64) string {
	for _, p := range promos {
		if p.Percent <= 0 {
			continue
		}
		if p.Type == NotaPercent && subtotal >= p.MinBuy && pct(subtotal, p.Percent) == want {
			return p.Name
		}
		if p.Type == HappyHour && p.StartHour != nil && p.EndHour != nil &&
			inWindow(hour, *p.StartHour, *p.EndHour) && pct(subtotal, p.Percent) == want {
			return p.Name
		}
	}
	return "Promo"
}

package promo

import "testing"

func ptrStr(s string) *string { return &s }
func ptrInt(i int) *int       { return &i }

func TestComputeNotaPercent(t *testing.T) {
	promos := []Promo{{ID: "1", Name: "Diskon 10%", Type: NotaPercent, Percent: 10, MinBuy: 50000}}
	// Belanja 100rb → diskon 10rb.
	r := Compute([]Line{{ProductID: "p", Qty: 1, LineTotal: 100000}}, 100000, 12, promos)
	if r.Discount != 10000 {
		t.Fatalf("nota_percent: mau 10000, dapat %d", r.Discount)
	}
	// Di bawah min belanja → tidak ada diskon.
	r = Compute([]Line{{ProductID: "p", Qty: 1, LineTotal: 40000}}, 40000, 12, promos)
	if r.Discount != 0 {
		t.Fatalf("nota_percent di bawah min: mau 0, dapat %d", r.Discount)
	}
}

func TestComputeProductQty(t *testing.T) {
	promos := []Promo{
		{ID: "2", Name: "Beli 3 diskon 20%", Type: ProductQty, Percent: 20, ProductID: ptrStr("kopi"), MinQty: 3},
	}
	// Qty 3 memenuhi → 20% dari 30rb = 6rb.
	r := Compute([]Line{{ProductID: "kopi", Qty: 3, LineTotal: 30000}}, 30000, 9, promos)
	if r.Discount != 6000 {
		t.Fatalf("product_qty memenuhi: mau 6000, dapat %d", r.Discount)
	}
	// Qty 2 < min → tidak ada diskon.
	r = Compute([]Line{{ProductID: "kopi", Qty: 2, LineTotal: 20000}}, 20000, 9, promos)
	if r.Discount != 0 {
		t.Fatalf("product_qty kurang qty: mau 0, dapat %d", r.Discount)
	}
}

func TestComputeHappyHour(t *testing.T) {
	promos := []Promo{
		{ID: "3", Name: "Happy Hour", Type: HappyHour, Percent: 15, StartHour: ptrInt(14), EndHour: ptrInt(17)},
	}
	// Jam 15 dalam window → 15% dari 20rb = 3rb.
	if r := Compute([]Line{{ProductID: "p", Qty: 1, LineTotal: 20000}}, 20000, 15, promos); r.Discount != 3000 {
		t.Fatalf("happy hour aktif: mau 3000, dapat %d", r.Discount)
	}
	// Jam 18 di luar window → 0.
	if r := Compute([]Line{{ProductID: "p", Qty: 1, LineTotal: 20000}}, 20000, 18, promos); r.Discount != 0 {
		t.Fatalf("happy hour luar window: mau 0, dapat %d", r.Discount)
	}
}

func TestComputeNotaLevelTakesBestNoStack(t *testing.T) {
	// Dua promo level-nota: ambil yang terbesar saja (tidak menumpuk).
	promos := []Promo{
		{ID: "a", Name: "10%", Type: NotaPercent, Percent: 10, MinBuy: 0},
		{ID: "b", Name: "HH 20%", Type: HappyHour, Percent: 20, StartHour: ptrInt(0), EndHour: ptrInt(23)},
	}
	r := Compute([]Line{{ProductID: "p", Qty: 1, LineTotal: 100000}}, 100000, 10, promos)
	if r.Discount != 20000 { // hanya 20%, bukan 30%
		t.Fatalf("nota-level no-stack: mau 20000, dapat %d", r.Discount)
	}
}

func TestComputeProductPlusNotaStacks(t *testing.T) {
	promos := []Promo{
		{ID: "p1", Name: "Beli 2 kopi 50%", Type: ProductQty, Percent: 50, ProductID: ptrStr("kopi"), MinQty: 2},
		{ID: "n1", Name: "Nota 10%", Type: NotaPercent, Percent: 10, MinBuy: 0},
	}
	// kopi line 20rb qty2 → -10rb; nota 10% dari 20rb → -2rb; total 12rb.
	r := Compute([]Line{{ProductID: "kopi", Qty: 2, LineTotal: 20000}}, 20000, 10, promos)
	if r.Discount != 12000 {
		t.Fatalf("product+nota stack: mau 12000, dapat %d", r.Discount)
	}
}

func TestComputeCappedAtSubtotal(t *testing.T) {
	promos := []Promo{{ID: "x", Name: "Gila 200%", Type: NotaPercent, Percent: 100, MinBuy: 0}}
	r := Compute([]Line{{ProductID: "p", Qty: 1, LineTotal: 5000}}, 5000, 10, promos)
	if r.Discount != 5000 {
		t.Fatalf("cap subtotal: mau 5000, dapat %d", r.Discount)
	}
}

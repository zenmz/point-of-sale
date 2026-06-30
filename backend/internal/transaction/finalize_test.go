package transaction

import "testing"

func TestFinalize(t *testing.T) {
	cases := []struct {
		name                      string
		subtotal, notaDisc        int64
		taxPct, svcPct            float64
		promoDisc                 int64
		wantDisc, wantPromo       int64
		wantTax, wantSvc, wantTot int64
	}{
		{"polos", 100000, 0, 0, 0, 0, 0, 0, 0, 0, 100000},
		{"diskon nota", 100000, 10000, 0, 0, 0, 10000, 0, 0, 0, 90000},
		{"promo sebelum pajak", 100000, 0, 10, 0, 20000, 0, 20000, 8000, 0, 88000},
		{"nota+promo+pajak+service", 100000, 10000, 10, 5, 20000, 10000, 20000, 7000, 3500, 80500},
		{"nota clamp ke subtotal", 50000, 99999, 0, 0, 0, 50000, 0, 0, 0, 0},
		{"promo clamp ke sisa", 50000, 30000, 0, 0, 99999, 30000, 20000, 0, 0, 0},
		{"persen negatif diabaikan", 100000, 0, -5, 0, 0, 0, 0, 0, 0, 100000},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := finalize(c.subtotal, c.notaDisc, c.taxPct, c.svcPct, c.promoDisc)
			if got.Discount != c.wantDisc || got.PromoDiscount != c.wantPromo ||
				got.Tax != c.wantTax || got.Service != c.wantSvc || got.Total != c.wantTot {
				t.Fatalf("finalize=%+v; mau disc=%d promo=%d tax=%d svc=%d total=%d",
					got, c.wantDisc, c.wantPromo, c.wantTax, c.wantSvc, c.wantTot)
			}
			// Total tak pernah negatif.
			if got.Total < 0 {
				t.Fatalf("total negatif: %d", got.Total)
			}
		})
	}
}

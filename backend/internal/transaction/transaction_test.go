package transaction

import "testing"

func TestClampNonNeg(t *testing.T) {
	cases := map[int64]int64{-5: 0, 0: 0, 7: 7}
	for in, want := range cases {
		if got := clampNonNeg(in); got != want {
			t.Errorf("clampNonNeg(%d) = %d, mau %d", in, got, want)
		}
	}
}

func TestClampPercent(t *testing.T) {
	cases := map[float64]float64{-1: 0, 0: 0, 11: 11, 100: 100, 150: 100}
	for in, want := range cases {
		if got := clampPercent(in); got != want {
			t.Errorf("clampPercent(%v) = %v, mau %v", in, got, want)
		}
	}
}

func TestInsufficientStockError(t *testing.T) {
	err := &InsufficientStockError{Name: "Kopi", Available: 2, Requested: 5}
	want := `stok "Kopi" tidak cukup (tersedia 2, diminta 5)`
	if err.Error() != want {
		t.Errorf("pesan = %q, mau %q", err.Error(), want)
	}
}

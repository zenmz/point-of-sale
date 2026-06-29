package inventory

import "testing"

func TestApply(t *testing.T) {
	cases := []struct {
		name      string
		typ       MovementType
		old, qty  int64
		wantNew   int64
		wantDelta int64
	}{
		{"masuk nambah", Masuk, 5, 3, 8, 3},
		{"keluar ngurangi", Keluar, 5, 2, 3, -2},
		{"keluar sampai nol", Keluar, 5, 5, 0, -5},
		{"keluar lebih = negatif", Keluar, 5, 8, -3, -8},
		{"penyesuaian naik", Penyesuaian, 5, 12, 12, 7},
		{"penyesuaian turun", Penyesuaian, 5, 2, 2, -3},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotNew, gotDelta := apply(tc.typ, tc.old, tc.qty)
			if gotNew != tc.wantNew || gotDelta != tc.wantDelta {
				t.Fatalf("apply(%s,%d,%d) = (%d,%d), mau (%d,%d)",
					tc.typ, tc.old, tc.qty, gotNew, gotDelta, tc.wantNew, tc.wantDelta)
			}
		})
	}
}

func TestMovementTypeValid(t *testing.T) {
	for _, ok := range []MovementType{Masuk, Keluar, Penyesuaian} {
		if !ok.valid() {
			t.Errorf("%q harusnya valid", ok)
		}
	}
	for _, bad := range []MovementType{"", "foo", "MASUK"} {
		if MovementType(bad).valid() {
			t.Errorf("%q harusnya tidak valid", bad)
		}
	}
}

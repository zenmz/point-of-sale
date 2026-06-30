package auth

import "testing"

func TestAuthorizeTarget(t *testing.T) {
	cases := []struct {
		name                                       string
		callerRole, callerStore, tgtStore, tgtRole string
		wantErr                                    bool
	}{
		{"owner kelola cabang lain", "owner", "A", "B", "admin", false},
		{"owner tetapkan owner", "owner", "A", "B", "owner", false},
		{"admin cabang sendiri", "admin", "A", "A", "kasir", false},
		{"admin cabang lain ditolak", "admin", "A", "B", "kasir", true},
		{"admin tetapkan owner ditolak", "admin", "A", "A", "owner", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := authorizeTarget(tc.callerRole, tc.callerStore, tc.tgtStore, tc.tgtRole)
			if (err != nil) != tc.wantErr {
				t.Fatalf("authorizeTarget(%s,%s,%s,%s) err=%v, wantErr=%v",
					tc.callerRole, tc.callerStore, tc.tgtStore, tc.tgtRole, err, tc.wantErr)
			}
		})
	}
}

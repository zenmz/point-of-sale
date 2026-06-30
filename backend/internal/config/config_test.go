package config

import "testing"

func TestValidate(t *testing.T) {
	good := "rahasia-produksi-yang-panjang"
	cases := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{"dev apa saja boleh", Config{AppEnv: "development", JWTSecret: DefaultJWTSecret}, false},
		{"prod secret default ditolak", Config{AppEnv: "production", JWTSecret: DefaultJWTSecret, CORSOrigins: "https://a"}, true},
		{"prod secret kosong ditolak", Config{AppEnv: "production", JWTSecret: "", CORSOrigins: "https://a"}, true},
		{"prod secret pendek ditolak", Config{AppEnv: "production", JWTSecret: "pendek", CORSOrigins: "https://a"}, true},
		{"prod tanpa CORS ditolak", Config{AppEnv: "production", JWTSecret: good, CORSOrigins: ""}, true},
		{"prod lengkap lolos", Config{AppEnv: "production", JWTSecret: good, CORSOrigins: "https://app.contoh.com"}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := c.cfg.Validate(); (err != nil) != c.wantErr {
				t.Fatalf("Validate() err=%v, wantErr=%v", err, c.wantErr)
			}
		})
	}
}

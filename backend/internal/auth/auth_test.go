package auth

import (
	"testing"
	"time"
)

func TestHashAndVerifyPassword(t *testing.T) {
	hash, err := HashPassword("rahasia123")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if hash == "rahasia123" {
		t.Fatal("hash sama dengan plaintext")
	}

	ok, err := VerifyPassword("rahasia123", hash)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if !ok {
		t.Fatal("password benar ditolak")
	}

	ok, _ = VerifyPassword("salah", hash)
	if ok {
		t.Fatal("password salah diterima")
	}
}

func TestVerifyPasswordInvalidHash(t *testing.T) {
	if _, err := VerifyPassword("x", "bukan-hash-valid"); err == nil {
		t.Fatal("hash tidak valid harusnya error")
	}
}

func TestTokenGenerateAndParse(t *testing.T) {
	m := NewTokenManager("secret-test", 24)
	tok, err := m.Generate("u1", "s1", "admin", time.Now())
	if err != nil {
		t.Fatalf("generate: %v", err)
	}

	claims, err := m.Parse(tok)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.UserID != "u1" || claims.StoreID != "s1" || claims.Role != "admin" {
		t.Fatalf("claims salah: %+v", claims)
	}
}

func TestTokenExpired(t *testing.T) {
	m := NewTokenManager("secret-test", 24)
	// Terbitkan token yang sudah lewat masa berlaku (issuedAt 2 hari lalu, expiry 24 jam).
	tok, _ := m.Generate("u1", "s1", "kasir", time.Now().Add(-48*time.Hour))
	if _, err := m.Parse(tok); err == nil {
		t.Fatal("token kedaluwarsa harusnya ditolak")
	}
}

func TestTokenWrongSecret(t *testing.T) {
	tok, _ := NewTokenManager("secret-a", 24).Generate("u1", "s1", "admin", time.Now())
	if _, err := NewTokenManager("secret-b", 24).Parse(tok); err == nil {
		t.Fatal("token dengan secret beda harusnya ditolak")
	}
}

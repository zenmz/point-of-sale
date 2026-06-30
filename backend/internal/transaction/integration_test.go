//go:build integration

// Tes integrasi jalur uang checkout terhadap Postgres nyata. Tidak ikut
// `go test ./...` biasa (butuh tag). Jalankan:
//
//	TEST_DATABASE_URL=postgres://mzpos:mzpos@localhost:5432/mzpos?sslmode=disable \
//	  go test -tags=integration ./internal/transaction/
//
// Membuat toko sendiri (terisolasi via store_id) lalu membersihkannya.
package transaction

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func setupDB(t *testing.T) *pgxpool.Pool {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL tidak diset; lewati tes integrasi")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// seed membuat toko + produk + stok, mengembalikan id-nya. Hapus toko di cleanup
// (CASCADE membersihkan produk/inventory/transaksi terkait).
func seed(t *testing.T, pool *pgxpool.Pool, price, stock int64) (storeID, productID string) {
	ctx := context.Background()
	if err := pool.QueryRow(ctx, `INSERT INTO stores (name) VALUES ('IT Test') RETURNING id`).Scan(&storeID); err != nil {
		t.Fatalf("seed store: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM stores WHERE id=$1`, storeID) })
	if err := pool.QueryRow(ctx,
		`INSERT INTO products (store_id, name, price) VALUES ($1,'Kopi',$2) RETURNING id`,
		storeID, price).Scan(&productID); err != nil {
		t.Fatalf("seed product: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO inventory (product_id, store_id, quantity) VALUES ($1,$2,$3)`,
		productID, storeID, stock); err != nil {
		t.Fatalf("seed inventory: %v", err)
	}
	return storeID, productID
}

func stockOf(t *testing.T, pool *pgxpool.Pool, productID string) int64 {
	var q int64
	if err := pool.QueryRow(context.Background(),
		`SELECT quantity FROM inventory WHERE product_id=$1`, productID).Scan(&q); err != nil {
		t.Fatalf("stock: %v", err)
	}
	return q
}

func TestCheckoutMoneyAndStock(t *testing.T) {
	pool := setupDB(t)
	repo := NewRepository(pool)
	ctx := context.Background()
	storeID, productID := seed(t, pool, 10000, 100)

	// Checkout 3 pcs, pajak 10%, tunai. total = 30000 + 3000 = 33000.
	tx, err := repo.Create(ctx, CreateInput{
		StoreID: storeID, Items: []ItemInput{{ProductID: productID, Qty: 3}},
		TaxPercent: 10, Method: Tunai, PaidAmount: 50000, ClientID: "11111111-1111-1111-1111-111111111111",
	})
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	if tx.Subtotal != 30000 || tx.Tax != 3000 || tx.Total != 33000 {
		t.Fatalf("total salah: subtotal=%d tax=%d total=%d", tx.Subtotal, tx.Tax, tx.Total)
	}
	if got := stockOf(t, pool, productID); got != 97 {
		t.Fatalf("stok setelah jual: %d (mau 97)", got)
	}

	// Idempotensi: client_id sama → transaksi sama, stok tak berubah lagi.
	tx2, err := repo.Create(ctx, CreateInput{
		StoreID: storeID, Items: []ItemInput{{ProductID: productID, Qty: 3}},
		TaxPercent: 10, Method: Tunai, PaidAmount: 50000, ClientID: "11111111-1111-1111-1111-111111111111",
	})
	if err != nil {
		t.Fatalf("checkout idempoten: %v", err)
	}
	if tx2.ID != tx.ID {
		t.Fatalf("idempotensi gagal: id beda %s vs %s", tx2.ID, tx.ID)
	}
	if got := stockOf(t, pool, productID); got != 97 {
		t.Fatalf("stok setelah retry: %d (mau tetap 97)", got)
	}
}

func TestCheckoutOversellRejected(t *testing.T) {
	pool := setupDB(t)
	repo := NewRepository(pool)
	storeID, productID := seed(t, pool, 5000, 2)

	_, err := repo.Create(context.Background(), CreateInput{
		StoreID: storeID, Items: []ItemInput{{ProductID: productID, Qty: 5}},
		Method: Tunai, PaidAmount: 100000, ClientID: "22222222-2222-2222-2222-222222222222",
	})
	var insufficient *InsufficientStockError
	if err == nil || !errors.As(err, &insufficient) {
		t.Fatalf("oversell harusnya InsufficientStockError, dapat: %v", err)
	}
	if got := stockOf(t, pool, productID); got != 2 {
		t.Fatalf("stok tak boleh berubah saat oversell: %d", got)
	}
}

func TestCheckoutPromoApplied(t *testing.T) {
	pool := setupDB(t)
	repo := NewRepository(pool)
	ctx := context.Background()
	storeID, productID := seed(t, pool, 10000, 100)

	if _, err := pool.Exec(ctx,
		`INSERT INTO promotions (store_id, name, type, percent, min_purchase, is_active)
		 VALUES ($1,'Diskon 10%','nota_percent',10,0,TRUE)`, storeID); err != nil {
		t.Fatalf("seed promo: %v", err)
	}

	tx, err := repo.Create(ctx, CreateInput{
		StoreID: storeID, Items: []ItemInput{{ProductID: productID, Qty: 2}},
		Method: Tunai, PaidAmount: 50000, ClientID: "33333333-3333-3333-3333-333333333333",
	})
	if err != nil {
		t.Fatalf("checkout promo: %v", err)
	}
	// subtotal 20000, promo 10% = 2000, total 18000.
	if tx.PromoDiscount != 2000 || tx.Total != 18000 {
		t.Fatalf("promo salah: promo=%d total=%d (mau 2000/18000)", tx.PromoDiscount, tx.Total)
	}
}

package catalog

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound  = errors.New("data tidak ditemukan")
	ErrDuplicate = errors.New("sku atau barcode sudah dipakai")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// ---- Kategori ----

func (r *Repository) ListCategories(ctx context.Context, storeID string) ([]Category, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, store_id, name, created_at FROM categories
		 WHERE store_id = $1 ORDER BY name`, storeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cats := []Category{}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.StoreID, &c.Name, &c.CreatedAt); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

func (r *Repository) CreateCategory(ctx context.Context, storeID, name string) (*Category, error) {
	c := &Category{StoreID: storeID, Name: name}
	err := r.db.QueryRow(ctx,
		`INSERT INTO categories (store_id, name) VALUES ($1, $2)
		 RETURNING id, created_at`, storeID, name).Scan(&c.ID, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *Repository) UpdateCategory(ctx context.Context, storeID, id, name string) (*Category, error) {
	c := &Category{ID: id, StoreID: storeID, Name: name}
	err := r.db.QueryRow(ctx,
		`UPDATE categories SET name = $1, updated_at = now()
		 WHERE id = $2 AND store_id = $3 RETURNING created_at`,
		name, id, storeID).Scan(&c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *Repository) DeleteCategory(ctx context.Context, storeID, id string) error {
	tag, err := r.db.Exec(ctx,
		`DELETE FROM categories WHERE id = $1 AND store_id = $2`, id, storeID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- Produk ----

// ListProducts mengambil produk aktif per toko, opsional filter pencarian nama/sku/barcode.
func (r *Repository) ListProducts(ctx context.Context, storeID, search string) ([]Product, error) {
	rows, err := r.db.Query(ctx,
		`SELECT p.id, p.store_id, p.category_id, p.name, p.sku, p.barcode, p.price,
		        p.is_active, p.created_at,
		        (SELECT count(*) FROM variants v WHERE v.product_id = p.id) AS variant_count,
		        COALESCE(i.quantity, 0) AS stock
		 FROM products p
		 LEFT JOIN inventory i ON i.product_id = p.id
		 WHERE p.store_id = $1 AND p.is_active = TRUE
		   AND ($2 = '' OR p.name ILIKE '%'||$2||'%' OR p.sku ILIKE '%'||$2||'%' OR p.barcode ILIKE '%'||$2||'%')
		 ORDER BY p.name`, storeID, search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := []Product{}
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.StoreID, &p.CategoryID, &p.Name, &p.SKU,
			&p.Barcode, &p.Price, &p.IsActive, &p.CreatedAt, &p.VariantCount, &p.Stock); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, rows.Err()
}

// GetProduct mengambil satu produk beserta varian-nya.
func (r *Repository) GetProduct(ctx context.Context, storeID, id string) (*Product, error) {
	p := &Product{}
	err := r.db.QueryRow(ctx,
		`SELECT id, store_id, category_id, name, sku, barcode, price, is_active, created_at
		 FROM products WHERE id = $1 AND store_id = $2`, id, storeID).
		Scan(&p.ID, &p.StoreID, &p.CategoryID, &p.Name, &p.SKU, &p.Barcode,
			&p.Price, &p.IsActive, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	variants, err := r.listVariants(ctx, id)
	if err != nil {
		return nil, err
	}
	p.Variants = variants
	return p, nil
}

func (r *Repository) listVariants(ctx context.Context, productID string) ([]Variant, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, product_id, name, sku, price, created_at
		 FROM variants WHERE product_id = $1 ORDER BY name`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	variants := []Variant{}
	for rows.Next() {
		var v Variant
		if err := rows.Scan(&v.ID, &v.ProductID, &v.Name, &v.SKU, &v.Price, &v.CreatedAt); err != nil {
			return nil, err
		}
		variants = append(variants, v)
	}
	return variants, rows.Err()
}

// CreateProduct menyisipkan produk; ErrDuplicate bila sku/barcode bentrok.
func (r *Repository) CreateProduct(ctx context.Context, p *Product) (*Product, error) {
	err := r.db.QueryRow(ctx,
		`INSERT INTO products (store_id, category_id, name, sku, barcode, price)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, is_active, created_at`,
		p.StoreID, p.CategoryID, p.Name, p.SKU, p.Barcode, p.Price).
		Scan(&p.ID, &p.IsActive, &p.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, err
	}
	return p, nil
}

// UpdateProduct memperbarui field produk.
func (r *Repository) UpdateProduct(ctx context.Context, p *Product) (*Product, error) {
	tag, err := r.db.Exec(ctx,
		`UPDATE products
		 SET category_id = $1, name = $2, sku = $3, barcode = $4, price = $5, updated_at = now()
		 WHERE id = $6 AND store_id = $7`,
		p.CategoryID, p.Name, p.SKU, p.Barcode, p.Price, p.ID, p.StoreID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return r.GetProduct(ctx, p.StoreID, p.ID)
}

// DeleteProduct = soft delete (is_active = false) agar referensi transaksi tetap aman.
func (r *Repository) DeleteProduct(ctx context.Context, storeID, id string) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE products SET is_active = FALSE, updated_at = now()
		 WHERE id = $1 AND store_id = $2 AND is_active = TRUE`, id, storeID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- Varian ----

// ReplaceVariants mengganti seluruh varian produk dalam satu transaksi.
func (r *Repository) ReplaceVariants(ctx context.Context, productID string, variants []Variant) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rollback no-op bila sudah commit

	if _, err := tx.Exec(ctx, `DELETE FROM variants WHERE product_id = $1`, productID); err != nil {
		return err
	}
	for _, v := range variants {
		if _, err := tx.Exec(ctx,
			`INSERT INTO variants (product_id, name, sku, price) VALUES ($1, $2, $3, $4)`,
			productID, v.Name, v.SKU, v.Price); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

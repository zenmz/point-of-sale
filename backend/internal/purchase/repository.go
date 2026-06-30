package purchase

import (
	"context"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrSupplierNotFound = errors.New("pemasok tidak ditemukan")
	ErrPONotFound       = errors.New("PO tidak ditemukan")
	ErrProductNotFound  = errors.New("produk tidak ditemukan")
	ErrEmpty            = errors.New("PO tidak punya item")
	ErrNotOrdered       = errors.New("PO bukan berstatus dipesan")
	ErrAlreadyPaid      = errors.New("PO sudah lunas")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ---- Pemasok ----

func (r *Repository) ListSuppliers(ctx context.Context, storeID, search string) ([]Supplier, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, store_id, name, phone, email, address, created_at
		 FROM suppliers
		 WHERE store_id = $1 AND ($2 = '' OR name ILIKE '%'||$2||'%')
		 ORDER BY name`, storeID, search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Supplier{}
	for rows.Next() {
		var s Supplier
		if err := rows.Scan(&s.ID, &s.StoreID, &s.Name, &s.Phone, &s.Email, &s.Address, &s.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Repository) CreateSupplier(ctx context.Context, s *Supplier) (*Supplier, error) {
	err := r.db.QueryRow(ctx,
		`INSERT INTO suppliers (store_id, name, phone, email, address)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
		s.StoreID, s.Name, s.Phone, s.Email, s.Address).Scan(&s.ID, &s.CreatedAt)
	return s, err
}

func (r *Repository) UpdateSupplier(ctx context.Context, storeID, id, name string, phone, email, address *string) (*Supplier, error) {
	s := &Supplier{}
	err := r.db.QueryRow(ctx,
		`UPDATE suppliers SET name=$3, phone=$4, email=$5, address=$6, updated_at=now()
		 WHERE id=$1 AND store_id=$2
		 RETURNING id, store_id, name, phone, email, address, created_at`,
		id, storeID, name, phone, email, address).
		Scan(&s.ID, &s.StoreID, &s.Name, &s.Phone, &s.Email, &s.Address, &s.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSupplierNotFound
	}
	return s, err
}

// ---- Purchase Order ----

// CreatePO membuat PO berstatus 'dipesan': snapshot nama & subtotal item,
// nomor PO berurut per toko (advisory lock), total = sum subtotal.
func (r *Repository) CreatePO(ctx context.Context, in CreateInput) (*PO, error) {
	if len(in.Items) == 0 {
		return nil, ErrEmpty
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "po:"+in.StoreID); err != nil {
		return nil, err
	}

	var supplierID *string
	if in.SupplierID != "" {
		var ok bool
		err := tx.QueryRow(ctx, `SELECT TRUE FROM suppliers WHERE id=$1 AND store_id=$2`,
			in.SupplierID, in.StoreID).Scan(&ok)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSupplierNotFound
		}
		if err != nil {
			return nil, err
		}
		supplierID = &in.SupplierID
	}

	type line struct {
		productID string
		name      string
		qty, cost int64
		subtotal  int64
	}
	lines := make([]line, 0, len(in.Items))
	var total int64
	for _, it := range in.Items {
		if it.Qty <= 0 || it.Cost < 0 {
			return nil, errors.New("qty/harga beli tidak valid")
		}
		var name string
		err := tx.QueryRow(ctx,
			`SELECT name FROM products WHERE id=$1 AND store_id=$2 AND is_active=TRUE`,
			it.ProductID, in.StoreID).Scan(&name)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		if err != nil {
			return nil, err
		}
		sub := it.Qty * it.Cost
		total += sub
		lines = append(lines, line{it.ProductID, name, it.Qty, it.Cost, sub})
	}

	var number int64
	if err := tx.QueryRow(ctx,
		`SELECT COALESCE(MAX(number),0)+1 FROM purchase_orders WHERE store_id=$1`,
		in.StoreID).Scan(&number); err != nil {
		return nil, err
	}

	var note *string
	if in.Note != "" {
		note = &in.Note
	}
	var createdBy *string
	if in.CreatedBy != "" {
		createdBy = &in.CreatedBy
	}

	var poID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO purchase_orders (store_id, supplier_id, number, total, note, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		in.StoreID, supplierID, number, total, note, createdBy).Scan(&poID); err != nil {
		return nil, err
	}
	for _, l := range lines {
		if _, err := tx.Exec(ctx,
			`INSERT INTO po_items (po_id, product_id, name, qty, cost, subtotal)
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			poID, l.productID, l.name, l.qty, l.cost, l.subtotal); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetPO(ctx, in.StoreID, poID)
}

// ReceivePO menerima barang: tambah stok tiap item + catat movement 'masuk',
// set status 'diterima'. Hanya boleh dari status 'dipesan'.
func (r *Repository) ReceivePO(ctx context.Context, storeID, poID, userID string) (*PO, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var status string
	var number int64
	err = tx.QueryRow(ctx,
		`SELECT status, number FROM purchase_orders WHERE id=$1 AND store_id=$2 FOR UPDATE`,
		poID, storeID).Scan(&status, &number)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPONotFound
	}
	if err != nil {
		return nil, err
	}
	if status != "dipesan" {
		return nil, ErrNotOrdered
	}

	rows, err := tx.Query(ctx, `SELECT product_id, qty, cost FROM po_items WHERE po_id=$1`, poID)
	if err != nil {
		return nil, err
	}
	type recv struct {
		productID *string
		qty       int64
		cost      int64
	}
	var recvs []recv
	for rows.Next() {
		var rc recv
		if err := rows.Scan(&rc.productID, &rc.qty, &rc.cost); err != nil {
			rows.Close()
			return nil, err
		}
		recvs = append(recvs, rc)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var uid *string
	if userID != "" {
		uid = &userID
	}
	for _, rc := range recvs {
		if rc.productID == nil {
			continue // produk sudah dihapus; lewati penambahan stok
		}
		var newQty int64
		if err := tx.QueryRow(ctx,
			`INSERT INTO inventory (product_id, store_id, quantity, updated_at)
			 VALUES ($1,$2,$3,now())
			 ON CONFLICT (product_id)
			 DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now()
			 RETURNING quantity`,
			*rc.productID, storeID, rc.qty).Scan(&newQty); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO stock_movements (store_id, product_id, type, delta, qty_after, reason, user_id)
			 VALUES ($1,$2,'masuk',$3,$4,$5,$6)`,
			storeID, *rc.productID, rc.qty, newQty, poReason(number), uid); err != nil {
			return nil, err
		}
		// Perbarui harga modal produk dengan harga beli terakhir (untuk margin).
		if rc.cost > 0 {
			if _, err := tx.Exec(ctx, `UPDATE products SET cost=$2 WHERE id=$1`,
				*rc.productID, rc.cost); err != nil {
				return nil, err
			}
		}
	}

	if _, err := tx.Exec(ctx,
		`UPDATE purchase_orders SET status='diterima', received_at=now() WHERE id=$1`, poID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetPO(ctx, storeID, poID)
}

// PayPO menandai PO lunas (hutang dibayar).
func (r *Repository) PayPO(ctx context.Context, storeID, poID string) (*PO, error) {
	ct, err := r.db.Exec(ctx,
		`UPDATE purchase_orders SET is_paid=TRUE WHERE id=$1 AND store_id=$2 AND is_paid=FALSE`,
		poID, storeID)
	if err != nil {
		return nil, err
	}
	if ct.RowsAffected() == 0 {
		// Bedakan tidak ada vs sudah lunas.
		var paid bool
		e := r.db.QueryRow(ctx, `SELECT is_paid FROM purchase_orders WHERE id=$1 AND store_id=$2`,
			poID, storeID).Scan(&paid)
		if errors.Is(e, pgx.ErrNoRows) {
			return nil, ErrPONotFound
		}
		if e != nil {
			return nil, e
		}
		if paid {
			return nil, ErrAlreadyPaid
		}
	}
	return r.GetPO(ctx, storeID, poID)
}

// CancelPO membatalkan PO yang masih 'dipesan'.
func (r *Repository) CancelPO(ctx context.Context, storeID, poID string) (*PO, error) {
	ct, err := r.db.Exec(ctx,
		`UPDATE purchase_orders SET status='batal' WHERE id=$1 AND store_id=$2 AND status='dipesan'`,
		poID, storeID)
	if err != nil {
		return nil, err
	}
	if ct.RowsAffected() == 0 {
		return nil, ErrNotOrdered
	}
	return r.GetPO(ctx, storeID, poID)
}

func (r *Repository) ListPOs(ctx context.Context, storeID string) ([]PO, error) {
	rows, err := r.db.Query(ctx,
		`SELECT po.id, po.store_id, po.supplier_id, s.name, po.number, po.status,
		        po.total, po.is_paid, po.note, po.created_at, po.received_at
		 FROM purchase_orders po
		 LEFT JOIN suppliers s ON s.id = po.supplier_id
		 WHERE po.store_id = $1
		 ORDER BY po.created_at DESC LIMIT 200`, storeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PO{}
	for rows.Next() {
		var p PO
		if err := rows.Scan(&p.ID, &p.StoreID, &p.SupplierID, &p.SupplierName, &p.Number,
			&p.Status, &p.Total, &p.IsPaid, &p.Note, &p.CreatedAt, &p.ReceivedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) GetPO(ctx context.Context, storeID, id string) (*PO, error) {
	p := &PO{}
	err := r.db.QueryRow(ctx,
		`SELECT po.id, po.store_id, po.supplier_id, s.name, po.number, po.status,
		        po.total, po.is_paid, po.note, po.created_at, po.received_at
		 FROM purchase_orders po
		 LEFT JOIN suppliers s ON s.id = po.supplier_id
		 WHERE po.id = $1 AND po.store_id = $2`, id, storeID).
		Scan(&p.ID, &p.StoreID, &p.SupplierID, &p.SupplierName, &p.Number,
			&p.Status, &p.Total, &p.IsPaid, &p.Note, &p.CreatedAt, &p.ReceivedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPONotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx,
		`SELECT id, product_id, name, qty, cost, subtotal FROM po_items WHERE po_id=$1 ORDER BY id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	p.Items = []POItem{}
	for rows.Next() {
		var it POItem
		if err := rows.Scan(&it.ID, &it.ProductID, &it.Name, &it.Qty, &it.Cost, &it.Subtotal); err != nil {
			return nil, err
		}
		p.Items = append(p.Items, it)
	}
	return p, rows.Err()
}

// Debt mengembalikan total hutang (PO diterima & belum lunas).
func (r *Repository) Debt(ctx context.Context, storeID string) (int64, int64, error) {
	var total, count int64
	err := r.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(total),0), COUNT(*) FROM purchase_orders
		 WHERE store_id=$1 AND status='diterima' AND is_paid=FALSE`, storeID).Scan(&total, &count)
	return total, count, err
}

func poReason(number int64) string {
	return "penerimaan PO #" + strconv.FormatInt(number, 10)
}

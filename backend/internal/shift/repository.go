package shift

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNoOpenShift = errors.New("tidak ada shift terbuka")
	ErrAlreadyOpen = errors.New("masih ada shift terbuka")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const selectShift = `SELECT s.id, s.store_id, s.user_id, u.name, s.opening_cash,
	s.closing_cash, s.status, s.note, s.opened_at, s.closed_at
	FROM shifts s LEFT JOIN users u ON u.id = s.user_id`

func scanShift(row pgx.Row) (*Shift, error) {
	s := &Shift{}
	err := row.Scan(&s.ID, &s.StoreID, &s.UserID, &s.UserName, &s.OpeningCash,
		&s.ClosingCash, &s.Status, &s.Note, &s.OpenedAt, &s.ClosedAt)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// Current mengembalikan shift terbuka milik user (dengan rekap berjalan).
func (r *Repository) Current(ctx context.Context, storeID, userID string) (*Shift, error) {
	s, err := scanShift(r.db.QueryRow(ctx,
		selectShift+` WHERE s.user_id = $1 AND s.store_id = $2 AND s.status = 'buka'`,
		userID, storeID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoOpenShift
	}
	if err != nil {
		return nil, err
	}
	return r.withSummary(ctx, s)
}

// Open membuka shift baru (kas awal). ErrAlreadyOpen bila sudah ada yang terbuka.
func (r *Repository) Open(ctx context.Context, storeID, userID string, openingCash int64, note *string) (*Shift, error) {
	var id string
	err := r.db.QueryRow(ctx,
		`INSERT INTO shifts (store_id, user_id, opening_cash, note)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		storeID, userID, openingCash, note).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrAlreadyOpen
		}
		return nil, err
	}
	return r.get(ctx, storeID, id)
}

// Close menutup shift terbuka milik user (kas akhir) dan mengembalikan rekap.
func (r *Repository) Close(ctx context.Context, storeID, userID string, closingCash int64, note *string) (*Shift, error) {
	var id string
	err := r.db.QueryRow(ctx,
		`UPDATE shifts SET closing_cash = $1, status = 'tutup', closed_at = now(),
		        note = COALESCE($2, note)
		 WHERE user_id = $3 AND store_id = $4 AND status = 'buka'
		 RETURNING id`,
		closingCash, note, userID, storeID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoOpenShift
	}
	if err != nil {
		return nil, err
	}
	return r.get(ctx, storeID, id)
}

func (r *Repository) get(ctx context.Context, storeID, id string) (*Shift, error) {
	s, err := scanShift(r.db.QueryRow(ctx,
		selectShift+` WHERE s.id = $1 AND s.store_id = $2`, id, storeID))
	if err != nil {
		return nil, err
	}
	return r.withSummary(ctx, s)
}

// withSummary melampirkan rekap penjualan ke shift.
func (r *Repository) withSummary(ctx context.Context, s *Shift) (*Shift, error) {
	to := time.Now()
	if s.ClosedAt != nil {
		to = *s.ClosedAt
	}
	sum, err := r.summary(ctx, s.StoreID, s.UserID, s.OpenedAt, to, s.OpeningCash, s.ClosingCash)
	if err != nil {
		return nil, err
	}
	s.Summary = sum
	return s, nil
}

// summary menghitung rekap dari transaksi 'selesai' milik kasir pada rentang waktu.
func (r *Repository) summary(ctx context.Context, storeID, userID string, from, to time.Time, opening int64, closing *int64) (*Summary, error) {
	var count, cash, noncash int64
	err := r.db.QueryRow(ctx,
		`SELECT COUNT(DISTINCT t.id),
		        COALESCE(SUM(CASE WHEN p.method = 'tunai' THEN p.amount - p.change_amount ELSE 0 END), 0),
		        COALESCE(SUM(CASE WHEN p.method <> 'tunai' THEN p.amount ELSE 0 END), 0)
		 FROM transactions t
		 JOIN payments p ON p.transaction_id = t.id
		 WHERE t.store_id = $1 AND t.cashier_id = $2 AND t.status = 'selesai'
		   AND t.created_at >= $3 AND t.created_at <= $4`,
		storeID, userID, from, to).Scan(&count, &cash, &noncash)
	if err != nil {
		return nil, err
	}

	expected := opening + cash
	var diff int64
	if closing != nil {
		diff = *closing - expected
	}
	return &Summary{
		TxCount:      count,
		CashSales:    cash,
		NonCashSales: noncash,
		TotalSales:   cash + noncash,
		ExpectedCash: expected,
		Difference:   diff,
	}, nil
}

package auth

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// pgErrorCode mengekstrak SQLSTATE dari error pgx, atau "" bila bukan PgError.
func pgErrorCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

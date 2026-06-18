# MZ POS

Aplikasi Point of Sale (POS) berbasis web (PWA), general/hybrid, multi-toko,
tahan offline untuk transaksi. Pasar: Indonesia (QRIS, e-wallet, transfer).

## Stack

- **Frontend:** React + Vite + TypeScript, PWA (IndexedDB/Dexie)
- **Backend:** Go + Fiber, PostgreSQL
- **Auth:** JWT, RBAC

## Struktur

```
backend/    API Go + Fiber
frontend/   React PWA
docs/        Desain, PRD, task breakdown
```

## Dokumentasi

- [Desain & Arsitektur](./docs/2026-06-18-mz-pos-design.md)
- [PRD](./docs/2026-06-18-mz-pos-prd.md)
- [Task Breakdown](./docs/2026-06-18-mz-pos-tasks.md)

## Mulai (development)

```bash
# 1. Jalankan database
docker compose up -d db

# 2. Backend
cd backend && cp .env.example .env && go run ./cmd/api

# 3. Frontend
cd frontend && npm install && npm run dev
```

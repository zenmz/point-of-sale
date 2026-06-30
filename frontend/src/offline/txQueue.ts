import { db, type PendingTx } from "./db";
import type { CheckoutInput } from "../types/transaction";

// enqueue menyimpan transaksi ke antrian lokal (status pending).
// Mengembalikan record yang tersimpan. payload harus sudah berisi client_id.
export async function enqueue(payload: CheckoutInput, total: number): Promise<PendingTx> {
  const rec: PendingTx = {
    client_id: payload.client_id!,
    payload,
    total,
    created_at: Date.now(),
    status: "pending",
  };
  await db.pendingTx.put(rec);
  return rec;
}

export async function countPending(): Promise<number> {
  return db.pendingTx.count();
}

export async function listPending(): Promise<PendingTx[]> {
  return db.pendingTx.orderBy("created_at").toArray();
}

export async function removePending(clientId: string): Promise<void> {
  await db.pendingTx.delete(clientId);
}

// newClientId membuat UUID untuk idempotensi (fallback bila crypto.randomUUID tak ada).
export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

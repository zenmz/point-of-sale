import { db } from "./db";
import { listPending, removePending } from "./txQueue";
import * as txApi from "../api/transaction";
import { ApiError } from "../api/client";

export interface SyncResult {
  synced: number;
  failed: number; // konflik/validasi server (ditandai untuk admin)
  stoppedOffline: boolean; // berhenti karena jaringan putus
}

let running = false;

// syncPending mengirim antrian transaksi 'pending' ke server (idempoten via
// client_id). Sukses → hapus dari antrian. Error HTTP (mis. stok kurang) →
// tandai 'error' untuk admin (tidak di-retry otomatis). Error jaringan →
// berhenti agar dicoba lagi putaran berikutnya.
export async function syncPending(onProgress?: () => void): Promise<SyncResult> {
  const res: SyncResult = { synced: 0, failed: 0, stoppedOffline: false };
  if (running || !navigator.onLine) return res;
  running = true;
  try {
    const items = (await listPending()).filter((it) => it.status === "pending");
    for (const it of items) {
      try {
        await txApi.checkout(it.payload);
        await removePending(it.client_id);
        res.synced++;
      } catch (err) {
        if (err instanceof ApiError) {
          await db.pendingTx.update(it.client_id, { status: "error", error: err.message });
          res.failed++;
        } else {
          res.stoppedOffline = true;
          break;
        }
      }
      onProgress?.();
    }
  } finally {
    running = false;
  }
  return res;
}

// retryErrors mengembalikan transaksi berstatus 'error' ke 'pending' lalu sync
// ulang (dipakai admin setelah memperbaiki stok / konflik).
export async function retryErrors(onProgress?: () => void): Promise<SyncResult> {
  const errs = await db.pendingTx.where("status").equals("error").toArray();
  await Promise.all(
    errs.map((e) => db.pendingTx.update(e.client_id, { status: "pending", error: undefined })),
  );
  return syncPending(onProgress);
}

export async function counts(): Promise<{ pending: number; errors: number }> {
  const [pending, errors] = await Promise.all([
    db.pendingTx.where("status").equals("pending").count(),
    db.pendingTx.where("status").equals("error").count(),
  ]);
  return { pending, errors };
}

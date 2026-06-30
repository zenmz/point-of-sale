// Layar pelanggan (customer display) lewat BroadcastChannel: kasir menyiarkan
// isi keranjang ke jendela /display di monitor menghadap pelanggan (sama-origin).
//
// ponytail: BroadcastChannel cukup untuk dua jendela di mesin yang sama; tak
// perlu server/websocket. Buka /display di layar kedua.

export interface DisplayItem {
  name: string;
  qty: number;
  price: number;
}

export interface DisplayState {
  status: "idle" | "active" | "done";
  items: DisplayItem[];
  total: number;
  store?: string;
}

const NAME = "mzpos-display";

let channel: BroadcastChannel | null = null;
function chan(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(NAME);
  return channel;
}

export function postDisplay(state: DisplayState) {
  chan()?.postMessage(state);
}

// subscribeDisplay mendengarkan pembaruan; mengembalikan fungsi untuk berhenti.
export function subscribeDisplay(cb: (s: DisplayState) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(NAME);
  ch.onmessage = (e) => cb(e.data as DisplayState);
  return () => ch.close();
}

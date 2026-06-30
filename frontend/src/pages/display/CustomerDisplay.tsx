import { useEffect, useState } from "react";
import { subscribeDisplay, type DisplayState } from "../../lib/customerDisplay";
import { formatRupiah } from "../../lib/format";

const IDLE: DisplayState = { status: "idle", items: [], total: 0 };

// CustomerDisplay: layar penuh menghadap pelanggan. Buka di monitor kedua
// (window.open('/display')). Menerima isi keranjang via BroadcastChannel.
export function CustomerDisplay() {
  const [state, setState] = useState<DisplayState>(IDLE);

  useEffect(() => subscribeDisplay(setState), []);

  return (
    <div className="cust-display">
      {state.status === "done" ? (
        <div className="cust-center">
          <div className="cust-thanks">Terima kasih 🙏</div>
          <div className="cust-total money">{formatRupiah(state.total)}</div>
        </div>
      ) : state.items.length === 0 ? (
        <div className="cust-center">
          <div className="cust-welcome">{state.store ?? "Selamat datang"}</div>
          <p className="muted">Silakan, kami siap melayani.</p>
        </div>
      ) : (
        <div className="cust-sale">
          <div className="cust-items">
            {state.items.map((it, i) => (
              <div key={i} className="cust-item">
                <span>
                  {it.name} <span className="muted">×{it.qty}</span>
                </span>
                <span className="money">{formatRupiah(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="cust-foot">
            <span>Total</span>
            <span className="cust-total money">{formatRupiah(state.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

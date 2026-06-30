import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as storeApi from "../api/store";
import type { Store } from "../types/store";

// StoreSwitcher: chip cabang aktif di topbar. Owner bisa pindah cabang;
// role lain hanya melihat nama cabangnya (tanpa dropdown).
export function StoreSwitcher() {
  const { user, switchStore } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isOwner = user?.role === "owner";

  useEffect(() => {
    storeApi
      .listStores()
      .then(setStores)
      .catch(() => setStores([]));
  }, [user?.store_id]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = stores.find((s) => s.id === user?.store_id);
  const label = current?.name ?? "Cabang";

  async function pick(id: string) {
    if (id === user?.store_id) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await switchStore(id); // memuat ulang halaman
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner) {
    return (
      <span className="chip chip-brand shift-chip" title="Cabang aktif">
        <span className="chip-dot" />
        {label}
      </span>
    );
  }

  return (
    <div className="store-switcher" ref={ref}>
      <button
        className="chip chip-brand shift-chip"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
      >
        <span className="chip-dot" />
        {busy ? "Pindah…" : label} ▾
      </button>
      {open && (
        <div className="store-menu">
          {stores.map((s) => (
            <button
              key={s.id}
              className={`store-menu-item${s.id === user?.store_id ? " active" : ""}`}
              onClick={() => pick(s.id)}
              disabled={!s.is_active && s.id !== user?.store_id}
            >
              {s.name}
              {!s.is_active && <span className="muted"> · nonaktif</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

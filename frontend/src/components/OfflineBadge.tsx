import { useOnline } from "../hooks/useOnline";

// Indikator status offline di topbar. Tersembunyi saat online.
export function OfflineBadge() {
  const online = useOnline();
  if (online) return null;
  return (
    <span className="chip offline-chip" title="Tidak ada koneksi">
      <span className="chip-dot" />
      Offline
    </span>
  );
}

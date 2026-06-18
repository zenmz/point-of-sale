import { useEffect, useState } from "react";
import { api } from "./api/client";

type Health = { status: string; env: string };

function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Health>("/health")
      .then(setHealth)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>MZ POS</h1>
      <p>Point of Sale — multi-toko, offline-capable.</p>
      <section>
        <h2>Status Backend</h2>
        {error && <p style={{ color: "crimson" }}>Tidak terhubung: {error}</p>}
        {health && (
          <p style={{ color: "green" }}>
            API: {health.status} (env: {health.env})
          </p>
        )}
        {!health && !error && <p>Memeriksa…</p>}
      </section>
    </main>
  );
}

export default App;

// Registrasi service worker (hanya di build produksi agar tak ganggu HMR dev).
export function registerSW() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registrasi gagal — aplikasi tetap jalan tanpa offline shell.
    });
  });
}

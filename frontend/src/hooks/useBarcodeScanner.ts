import { useEffect, useRef } from "react";

// useBarcodeScanner mendeteksi scanner barcode mode "keyboard wedge": scanner
// mengetik kode sangat cepat lalu menekan Enter. Ketikan manusia jauh lebih
// lambat, jadi burst karakter dengan jeda < GAP ms dianggap hasil scan.
//
// ponytail: heuristik waktu (GAP) — andal untuk scanner USB HID umum; bukan
// protokol khusus. Naikkan MIN_LEN bila ada false-positive dari ketik cepat.
const GAP_MS = 40;
const MIN_LEN = 3;

export function useBarcodeScanner(onScan: (code: string) => void) {
  const cb = useRef(onScan);
  useEffect(() => {
    cb.current = onScan;
  });

  useEffect(() => {
    let buffer = "";
    let last = 0;

    function onKey(e: KeyboardEvent) {
      const now = performance.now();
      if (now - last > GAP_MS) buffer = ""; // jeda → mulai buffer baru
      last = now;

      if (e.key === "Enter") {
        if (buffer.length >= MIN_LEN) {
          e.preventDefault();
          cb.current(buffer);
        }
        buffer = "";
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

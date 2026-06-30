// Printer thermal lewat WebUSB + perintah ESC/POS minimal. Termasuk pemicu
// cash drawer (laci kas) yang biasanya tersambung ke printer.
//
// ponytail: ESC/POS 58/80mm umum (struk teks kiri-kanan + potong). Tidak
// menangani logo/barcode/QR — cukup untuk struk teks. Butuh HTTPS/localhost,
// gestur pengguna, dan izin perangkat (browser berbasis Chromium).

import type { Transaction } from "../types/transaction";
import { formatRupiah } from "./format";

// Tipe WebUSB minimal (hindari dependensi @types/w3c-web-usb).
interface UsbEndpoint {
  endpointNumber: number;
  direction: string;
}
interface UsbInterface {
  interfaceNumber: number;
  alternate: { endpoints: UsbEndpoint[] };
  claimed?: boolean;
}
interface UsbDevice {
  open(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  configuration: { interfaces: UsbInterface[] } | null;
  transferOut(endpoint: number, data: Uint8Array): Promise<unknown>;
}
interface UsbApi {
  requestDevice(opts: { filters: unknown[] }): Promise<UsbDevice>;
}

function getUsb(): UsbApi | undefined {
  return (navigator as unknown as { usb?: UsbApi }).usb;
}

export function isWebUSBSupported(): boolean {
  return getUsb() !== undefined;
}

const ESC = 0x1b;
const GS = 0x1d;
const enc = new TextEncoder();

function bytes(...parts: (number | Uint8Array)[]): Uint8Array {
  const chunks = parts.map((p) => (typeof p === "number" ? Uint8Array.of(p) : p));
  const len = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

// Pemicu laci kas: ESC p m t1 t2 (pulse pin 0).
const DRAWER_KICK = Uint8Array.of(ESC, 0x70, 0x00, 0x19, 0xfa);

export class ThermalPrinter {
  private device: UsbDevice | null = null;
  private endpoint = 1;

  // connect meminta pengguna memilih printer USB lalu klaim antarmuka OUT-nya.
  async connect(): Promise<void> {
    const usb = getUsb();
    if (!usb) throw new Error("Browser tidak mendukung WebUSB");
    const device = await usb.requestDevice({ filters: [] });
    await device.open();
    await device.selectConfiguration(1);
    const iface = device.configuration?.interfaces.find((i) =>
      i.alternate.endpoints.some((e) => e.direction === "out"),
    );
    if (!iface) throw new Error("Endpoint printer tidak ditemukan");
    await device.claimInterface(iface.interfaceNumber);
    const out = iface.alternate.endpoints.find((e) => e.direction === "out");
    this.endpoint = out ? out.endpointNumber : 1;
    this.device = device;
  }

  get connected(): boolean {
    return this.device !== null;
  }

  private async write(data: Uint8Array): Promise<void> {
    if (!this.device) throw new Error("Printer belum tersambung");
    await this.device.transferOut(this.endpoint, data);
  }

  // openDrawer mengirim pulse untuk membuka laci kas (lewat printer).
  async openDrawer(): Promise<void> {
    await this.write(DRAWER_KICK);
  }

  // printReceipt mencetak struk teks dari satu transaksi.
  async printReceipt(tx: Transaction): Promise<void> {
    const line = (l: string, r: string, width = 32) => {
      const space = Math.max(1, width - l.length - r.length);
      return l + " ".repeat(space) + r + "\n";
    };

    let body = "";
    body += `${tx.store_name}\n`;
    if (tx.store_address) body += `${tx.store_address}\n`;
    body += `Nota #${tx.number}\n`;
    body += "-".repeat(32) + "\n";
    for (const it of tx.items) {
      body += `${it.name}\n`;
      body += line(`  ${it.qty} x ${formatRupiah(it.price)}`, formatRupiah(it.line_total));
    }
    body += "-".repeat(32) + "\n";
    body += line("Subtotal", formatRupiah(tx.subtotal));
    if (tx.discount > 0) body += line("Diskon", "-" + formatRupiah(tx.discount));
    if (tx.promo_discount > 0) body += line("Promo", "-" + formatRupiah(tx.promo_discount));
    if (tx.tax > 0) body += line("Pajak", formatRupiah(tx.tax));
    if (tx.service_charge > 0) body += line("Service", formatRupiah(tx.service_charge));
    body += line("TOTAL", formatRupiah(tx.total));
    if (tx.payment) {
      body += line(`Bayar (${tx.payment.method})`, formatRupiah(tx.payment.amount));
      if (tx.payment.change > 0) body += line("Kembali", formatRupiah(tx.payment.change));
    }
    if (tx.customer_name) body += line("Member", tx.customer_name);
    if (tx.points_earned > 0) body += line("Poin didapat", `+${tx.points_earned}`);
    body += "\nTerima kasih!\n";

    const payload = bytes(
      ESC,
      0x40, // ESC @ : init
      enc.encode(body),
      0x0a,
      0x0a,
      0x0a,
      GS,
      0x56,
      0x42,
      0x00, // GS V B 0 : potong kertas
    );
    await this.write(payload);
  }
}

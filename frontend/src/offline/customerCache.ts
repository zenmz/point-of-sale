import { db } from "./db";
import * as customerApi from "../api/customer";
import { ApiError } from "../api/client";
import type { Customer } from "../types/customer";

function matches(c: Customer, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return c.name.toLowerCase().includes(s) || (c.phone?.toLowerCase().includes(s) ?? false);
}

async function getCached(search: string): Promise<Customer[]> {
  const all = await db.customers.orderBy("name").toArray();
  return all.filter((c) => matches(c, search)).slice(0, 100);
}

// searchCustomers mengambil member dari server (lalu cache) saat online; bila
// jaringan gagal (offline) jatuh ke cache lokal. Error HTTP tetap dilempar.
export async function searchCustomers(search: string): Promise<Customer[]> {
  try {
    const list = await customerApi.listCustomers(search);
    // Cache hanya hasil tanpa filter (pemanasan); cari berfilter cukup di memori.
    if (search === "") {
      await db.customers.clear();
      await db.customers.bulkPut(list);
    } else {
      await db.customers.bulkPut(list);
    }
    return list;
  } catch (err) {
    if (err instanceof ApiError) throw err; // server menjawab → bukan offline
    return getCached(search);
  }
}

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../api/client";
import * as storeApi from "../../api/store";
import * as usersApi from "../../api/users";
import { IconPlus } from "../../components/icons";
import type { Store } from "../../types/store";
import type { Role, User } from "../../types/auth";

export function PengaturanPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<string>(""); // owner: filter cabang ("" = semua)
  const [loading, setLoading] = useState(true);
  const [storeForm, setStoreForm] = useState<Store | "new" | null>(null);
  const [userForm, setUserForm] = useState<User | "new" | null>(null);

  const loadUsers = useCallback(async () => {
    setUsers(await usersApi.listUsers(isOwner ? filter || undefined : undefined));
  }, [isOwner, filter]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [st] = await Promise.all([storeApi.listStores(), loadUsers()]);
      setStores(st);
    } finally {
      setLoading(false);
    }
  }, [loadUsers]);

  useEffect(() => {
    const t = setTimeout(loadAll, 0);
    return () => clearTimeout(t);
  }, [loadAll]);

  function storeName(id: string) {
    return stores.find((s) => s.id === id)?.name ?? "—";
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Pengaturan</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {isOwner ? "Kelola cabang & pengguna" : "Kelola pengguna cabang"}
          </p>
        </div>
      </div>

      {isOwner && (
        <div className="card" style={{ padding: 0, marginBottom: "1.25rem" }}>
          <div className="row" style={{ justifyContent: "space-between", padding: "1rem" }}>
            <h2 style={{ margin: 0 }}>Cabang</h2>
            <button className="btn btn-primary" onClick={() => setStoreForm("new")}>
              <IconPlus size={18} />
              Tambah Cabang
            </button>
          </div>
          {loading ? (
            <p className="muted" style={{ padding: "0 1rem 1rem" }}>
              Memuat…
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Alamat</th>
                  <th>Telp</th>
                  <th className="center">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td className="muted">{s.address ?? "—"}</td>
                    <td className="muted">{s.phone ?? "—"}</td>
                    <td className="center">
                      {s.is_active ? (
                        <span className="chip chip-brand">aktif</span>
                      ) : (
                        <span className="chip chip-accent">nonaktif</span>
                      )}
                    </td>
                    <td className="num">
                      <button className="btn-link" onClick={() => setStoreForm(s)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="row" style={{ justifyContent: "space-between", padding: "1rem" }}>
          <h2 style={{ margin: 0 }}>Pengguna</h2>
          <div className="row" style={{ gap: "0.5rem" }}>
            {isOwner && (
              <select
                className="input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="">Semua cabang</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <button className="btn btn-primary" onClick={() => setUserForm("new")}>
              <IconPlus size={18} />
              Tambah Pengguna
            </button>
          </div>
        </div>
        {loading ? (
          <p className="muted" style={{ padding: "0 1rem 1rem" }}>
            Memuat…
          </p>
        ) : users.length === 0 ? (
          <p className="muted" style={{ padding: "0 1rem 1.5rem" }}>
            Belum ada pengguna.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                {isOwner && <th>Cabang</th>}
                <th>Role</th>
                <th className="center">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td className="muted">{u.email}</td>
                  {isOwner && <td>{storeName(u.store_id)}</td>}
                  <td>
                    <span className="chip chip-brand">{u.role}</span>
                  </td>
                  <td className="center">
                    {u.is_active ? (
                      <span className="chip chip-brand">aktif</span>
                    ) : (
                      <span className="chip chip-accent">nonaktif</span>
                    )}
                  </td>
                  <td className="num">
                    <button className="btn-link" onClick={() => setUserForm(u)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {storeForm && (
        <StoreFormModal
          store={storeForm === "new" ? null : storeForm}
          stores={stores}
          onClose={() => setStoreForm(null)}
          onSaved={() => {
            setStoreForm(null);
            loadAll();
          }}
        />
      )}
      {userForm && (
        <UserFormModal
          user={userForm === "new" ? null : userForm}
          stores={stores}
          isOwner={isOwner}
          ownStore={user?.store_id ?? ""}
          onClose={() => setUserForm(null)}
          onSaved={() => {
            setUserForm(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

function StoreFormModal({
  store,
  stores,
  onClose,
  onSaved,
}: {
  store: Store | null;
  stores: Store[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(store?.name ?? "");
  const [address, setAddress] = useState(store?.address ?? "");
  const [phone, setPhone] = useState(store?.phone ?? "");
  const [active, setActive] = useState(store?.is_active ?? true);
  const [copyFrom, setCopyFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: storeApi.StoreInput = {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        is_active: active,
      };
      if (store) {
        await storeApi.updateStore(store.id, payload);
      } else {
        await storeApi.createStore({ ...payload, copy_catalog_from: copyFrom || null });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{store ? "Edit Cabang" : "Tambah Cabang"}</h2>
        {error && <p className="err-box">{error}</p>}
        <label className="field">
          Nama cabang
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="field">
          Alamat (opsional)
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="field">
          Telepon (opsional)
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {!store && stores.length > 0 && (
          <label className="field">
            Salin katalog dari (opsional)
            <select className="input" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Mulai kosong (per-toko)</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {store && (
          <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Cabang aktif
          </label>
        )}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function UserFormModal({
  user,
  stores,
  isOwner,
  ownStore,
  onClose,
  onSaved,
}: {
  user: User | null;
  stores: Store[];
  isOwner: boolean;
  ownStore: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "kasir");
  const [storeId, setStoreId] = useState(user?.store_id ?? ownStore);
  const [active, setActive] = useState(user?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles: Role[] = isOwner ? ["owner", "admin", "kasir"] : ["admin", "kasir"];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (user) {
        await usersApi.updateUser(user.id, {
          name: name.trim(),
          role,
          is_active: active,
          password: password || undefined,
        });
      } else {
        await usersApi.createUser({
          store_id: isOwner ? storeId : undefined,
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{user ? "Edit Pengguna" : "Tambah Pengguna"}</h2>
        {error && <p className="err-box">{error}</p>}
        <label className="field">
          Nama
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="field">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!user}
          />
        </label>
        {isOwner && !user && (
          <label className="field">
            Cabang
            <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          Role
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {user ? "Password baru (kosongkan bila tetap)" : "Password (min. 8)"}
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {user && (
          <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Akun aktif
          </label>
        )}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

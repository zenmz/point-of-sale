import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { IconHome, IconCart, IconBox, IconLayers, IconChart, IconLogout, IconMenu } from "./icons";
import type { ComponentType } from "react";
import "./AppLayout.css";

interface NavConf {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  soon?: boolean;
}

// Menu mengikuti roadmap milestone; yang belum dibangun ditandai "segera".
const NAV: NavConf[] = [
  { to: "/", label: "Ringkasan", icon: IconHome },
  { to: "/kasir", label: "Kasir", icon: IconCart, soon: true },
  { to: "/products", label: "Produk", icon: IconBox },
  { to: "/stok", label: "Stok", icon: IconLayers },
  { to: "/laporan", label: "Laporan", icon: IconChart, soon: true },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const current = NAV.find((n) => n.to === location.pathname);
  const title = current?.label ?? "MZ POS";
  const initial = user?.name?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="shell">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">MZ</div>
          <span className="brand-name">POS</span>
        </div>

        <nav className="nav">
          <div className="nav-section">Operasi</div>
          {NAV.map((n) => {
            const Icon = n.icon;
            if (n.soon) {
              return (
                <span key={n.to} className="nav-item soon">
                  <Icon size={19} />
                  {n.label}
                  <span className="soon-tag">segera</span>
                </span>
              );
            }
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={19} />
                {n.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-foot">MZ POS · v0.1 MVP</div>
      </aside>

      <div className={`backdrop${open ? " show" : ""}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="burger" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              <IconMenu />
            </button>
            <span className="topbar-title">{title}</span>
          </div>

          <div className="topbar-right">
            <span className="chip chip-accent">
              <span className="chip-dot" />
              Shift belum dibuka
            </span>
            <div className="user-box">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <div className="avatar">{initial}</div>
            <button className="icon-btn" onClick={logout} aria-label="Keluar" title="Keluar">
              <IconLogout size={18} />
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

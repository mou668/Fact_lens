import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { Search, History, Cpu, Info, HelpCircle, LogOut, X, ChevronUp, ScanSearch } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext.jsx";

// Add new nav items here.
const NAV = [
  { to: "/analyze", label: "Analyze", icon: Search },
  { to: "/history", label: "History", icon: History },
  { to: "/models", label: "Models", icon: Cpu },
  { to: "/about", label: "About", icon: Info },
  { to: "/help", label: "Help", icon: HelpCircle },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { t } = usePreferences();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setMenu(false); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        aria-label={t("Main navigation")}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-slate-200 transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <ScanSearch className="h-6 w-6 text-primary" aria-hidden="true" /> FactLens
          </div>
          <button onClick={onClose} className="md:hidden" aria-label={t("Close navigation")}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive ? "bg-primary text-white" : "hover:bg-navy-light"}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" /> {t(label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="relative border-t border-white/10 p-3" ref={menuRef}>
          <button
            onClick={() => setMenu((m) => !m)}
            aria-haspopup="menu"
            aria-expanded={menu}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary font-semibold text-white" aria-hidden="true">
              {user?.name?.[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">{user?.name}</span>
              <span className="block truncate text-xs text-slate-400">{user?.email} · {user?.role}</span>
            </span>
            <ChevronUp className={`h-4 w-4 transition ${menu ? "" : "rotate-180"}`} aria-hidden="true" />
          </button>
          {menu && (
            <div role="menu" className="absolute bottom-full left-3 right-3 mb-2 rounded-lg bg-navy-light p-1 shadow-lg">
              <button role="menuitem" autoFocus onClick={() => logout()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <LogOut className="h-4 w-4" aria-hidden="true" /> {t("Sign out")}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

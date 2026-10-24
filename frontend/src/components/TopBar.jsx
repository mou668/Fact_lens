import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

export default function TopBar({ onMenu }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <button onClick={onMenu} className="rounded-md p-2 md:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
      <div className="flex-1" />
      <button
        onClick={toggle}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        className="rounded-md p-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800"
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
    </header>
  );
}

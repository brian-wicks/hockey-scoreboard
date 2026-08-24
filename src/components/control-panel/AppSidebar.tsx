import { Bookmark, House, LayoutGrid, Settings } from "lucide-react";
import type { ComponentType } from "react";

export type ActiveTab = "controls" | "settings" | "presets" | "streamdeck";

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "controls", label: "Controls", icon: House },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "presets", label: "Teams", icon: Bookmark },
  { id: "streamdeck", label: "Deck", icon: LayoutGrid },
];

interface AppSidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export default function AppSidebar({ activeTab, onSelectTab }: AppSidebarProps) {
  return (
    <>
      {/* Desktop: persistent vertical glass rail */}
      <nav
        aria-label="Primary"
        className="hidden md:flex flex-col w-20 shrink-0 border-r border-white/10 bg-white/[0.03] backdrop-blur-xl px-2 py-4 gap-1"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-white bg-indigo-500/20 border border-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.25)]"
                  : "text-zinc-400 border border-transparent hover:bg-white/[0.05] hover:text-zinc-200"
              }`}
            >
              <Icon size={18} />
              <span className="leading-tight text-center">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile: collapses to a fixed bottom bar */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-white/10 bg-zinc-950/80 backdrop-blur-xl"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-indigo-300" : "text-zinc-500"
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

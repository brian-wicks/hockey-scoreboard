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
      {/* Desktop: persistent vertical rail */}
      <nav aria-label="Primary" className="ui-dark hidden md:flex flex-col w-20 shrink-0 bg-ink px-2 py-4 gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 rounded-sm px-2 py-3 text-xs transition-colors ${
                isActive ? "bg-canvas text-ink font-semibold" : "text-canvas opacity-70 hover:opacity-100"
              }`}
            >
              <Icon size={18} />
              <span className="leading-tight text-center">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile: collapses to a fixed bottom bar */}
      <nav aria-label="Primary" className="ui-dark md:hidden fixed bottom-0 inset-x-0 z-40 flex bg-ink">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors ${
                isActive ? "bg-canvas text-ink font-semibold" : "text-canvas opacity-70"
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

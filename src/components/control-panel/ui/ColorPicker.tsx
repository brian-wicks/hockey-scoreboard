import { useEffect, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { cn } from "../../../utils/cn";
import { useDropdownPlacement } from "../DropdownInputs";

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
  /** Accessible name for the swatch/hex controls, e.g. "Home team color". Defaults to "Color". */
  label?: string;
}

/** Swatch + hex field that opens a themed react-colorful popover, replacing the
 * OS-native <input type="color"> picker everywhere a team/button color is edited. */
export function ColorPicker({ value, onChange, className, label = "Color" }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const { containerRef, dropUp } = useDropdownPlacement(open);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, containerRef]);

  return (
    <div ref={containerRef} className={cn("relative flex gap-3", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${label} swatch`}
        aria-expanded={open}
        className="w-12 h-12 shrink-0 rounded-lg border border-white/10 cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        style={{ backgroundColor: value }}
      />
      <HexColorInput
        color={value}
        onChange={onChange}
        prefixed
        aria-label={label}
        className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono uppercase"
      />
      {open && (
        <div
          className={cn(
            "control-panel-color-popover absolute left-0 z-20 p-3 rounded-2xl border border-white/10",
            "bg-zinc-950/95 backdrop-blur-xl shadow-2xl",
            dropUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <HexColorPicker color={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { PENALTY_OPTIONS } from "../../constants/penaltyOptions";

export function useDropdownPlacement(open: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dropUp, setDropUp] = useState(false);
  const [maxHeight, setMaxHeight] = useState(224);

  useEffect(() => {
    if (!open) return;

    const updatePlacement = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportPadding = 8;
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
      const availableAbove = rect.top - viewportPadding;
      const shouldDropUp = availableBelow < 180 && availableAbove > availableBelow;
      const available = shouldDropUp ? availableAbove : availableBelow;

      setDropUp(shouldDropUp);
      setMaxHeight(Math.max(120, Math.min(224, Math.floor(available))));
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  return { containerRef, dropUp, maxHeight };
}

interface PenaltyReasonInputProps {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
}

export function PenaltyReasonInput({ value, onChange, inputClassName }: PenaltyReasonInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const { containerRef, dropUp, maxHeight } = useDropdownPlacement(open);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const options = PENALTY_OPTIONS.filter((option) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return option.code.toLowerCase().includes(normalized) || option.label.toLowerCase().includes(normalized);
  });

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          onChange(query);
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onChange(query);
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={inputClassName}
        placeholder="Infraction"
      />
      {open && (
        <div
          className={`absolute left-0 z-20 w-56 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 shadow-lg ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {options.length === 0 ? (
            <div className="px-2 py-1 text-xs text-zinc-500">No matches</div>
          ) : (
            options.map((option) => (
              <button
                key={option.code}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(option.code);
                  onChange(option.code);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                <span className="font-mono">{option.code}</span>
                <span className="text-zinc-400"> - {option.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export interface SearchOption {
  value: string;
  label?: string;
}

export function SearchDropdownInput({
  value,
  onChange,
  inputClassName,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  placeholder: string;
  options: SearchOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const { containerRef, dropUp, maxHeight } = useDropdownPlacement(open);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filteredOptions = options.filter((option) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return option.value.toLowerCase().includes(normalized) || (option.label ?? "").toLowerCase().includes(normalized);
  });

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          onChange(query);
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onChange(query);
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={inputClassName}
        placeholder={placeholder}
      />
      {open && (
        <div
          className={`absolute left-0 z-20 w-56 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 shadow-lg ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-1 text-xs text-zinc-500">No matches</div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(option.value);
                  onChange(option.value);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                <span className="font-mono">{option.value}</span>
                {option.label ? <span className="text-zinc-400"> - {option.label}</span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

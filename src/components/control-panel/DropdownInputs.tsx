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
  const [draft, setDraft] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suppressBlurCommitRef = useRef(false);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { containerRef, dropUp, maxHeight } = useDropdownPlacement(open);

  const inputValue = open ? draft : value;

  const options = PENALTY_OPTIONS.filter((option) => {
    const normalized = inputValue.trim().toLowerCase();
    if (!normalized) return true;
    return option.code.toLowerCase().includes(normalized) || option.label.toLowerCase().includes(normalized);
  });

  const normalizedActiveIndex =
    open && options.length > 0 ? Math.min(Math.max(activeIndex, 0), options.length - 1) : -1;

  const scrollOptionIntoView = (index: number) => {
    if (!open || index < 0) return;
    requestAnimationFrame(() => {
      optionRefs.current[index]?.scrollIntoView({ block: "nearest" });
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        value={inputValue}
        onChange={(e) => {
          setDraft(e.target.value);
          if (open && options.length > 0) {
            setActiveIndex(0);
            scrollOptionIntoView(0);
          }
        }}
        onFocus={() => {
          setDraft(value);
          setOpen(true);
          if (options.length > 0) {
            setActiveIndex(0);
            scrollOptionIntoView(0);
          }
        }}
        onBlur={() => {
          if (suppressBlurCommitRef.current) {
            suppressBlurCommitRef.current = false;
            return;
          }
          onChange(inputValue);
          setOpen(false);
          setActiveIndex(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (!open) {
              setOpen(true);
              if (options.length > 0) {
                setActiveIndex(0);
                scrollOptionIntoView(0);
              } else {
                setActiveIndex(-1);
              }
              return;
            }
            if (options.length === 0) return;
            e.preventDefault();
            const delta = e.key === "ArrowDown" ? 1 : -1;
            const baseIndex = normalizedActiveIndex === -1 ? 0 : normalizedActiveIndex;
            const nextIndex = (baseIndex + delta + options.length) % options.length;
            setActiveIndex(nextIndex);
            scrollOptionIntoView(nextIndex);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (open && normalizedActiveIndex >= 0 && normalizedActiveIndex < options.length) {
              const selected = options[normalizedActiveIndex];
              setDraft(selected.code);
              onChange(selected.code);
              setOpen(false);
              setActiveIndex(-1);
              suppressBlurCommitRef.current = true;
              (e.target as HTMLInputElement).blur();
              return;
            }
            onChange(inputValue);
            setOpen(false);
            setActiveIndex(-1);
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
            options.map((option, index) => (
              <button
                key={option.code}
                type="button"
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraft(option.code);
                  onChange(option.code);
                  setOpen(false);
                  setActiveIndex(-1);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full text-left px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 ${
                  index === normalizedActiveIndex ? "bg-zinc-800" : ""
                }`}
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
  const [draft, setDraft] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suppressBlurCommitRef = useRef(false);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { containerRef, dropUp, maxHeight } = useDropdownPlacement(open);

  const inputValue = open ? draft : value;

  const filteredOptions = options.filter((option) => {
    const normalized = inputValue.trim().toLowerCase();
    if (!normalized) return true;
    return option.value.toLowerCase().includes(normalized) || (option.label ?? "").toLowerCase().includes(normalized);
  });

  const normalizedActiveIndex =
    open && filteredOptions.length > 0
      ? Math.min(Math.max(activeIndex, 0), filteredOptions.length - 1)
      : -1;

  const scrollOptionIntoView = (index: number) => {
    if (!open || index < 0) return;
    requestAnimationFrame(() => {
      optionRefs.current[index]?.scrollIntoView({ block: "nearest" });
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        value={inputValue}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
          if (filteredOptions.length > 0) {
            setActiveIndex(0);
            scrollOptionIntoView(0);
          }
        }}
        onFocus={() => {
          setDraft(value);
          setOpen(true);
          if (filteredOptions.length > 0) {
            setActiveIndex(0);
            scrollOptionIntoView(0);
          }
        }}
        onBlur={() => {
          if (suppressBlurCommitRef.current) {
            suppressBlurCommitRef.current = false;
            return;
          }
          onChange(inputValue);
          setOpen(false);
          setActiveIndex(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (!open) {
              setOpen(true);
              if (filteredOptions.length > 0) {
                setActiveIndex(0);
                scrollOptionIntoView(0);
              } else {
                setActiveIndex(-1);
              }
              return;
            }
            if (filteredOptions.length === 0) return;
            e.preventDefault();
            const delta = e.key === "ArrowDown" ? 1 : -1;
            const baseIndex = normalizedActiveIndex === -1 ? 0 : normalizedActiveIndex;
            const nextIndex = (baseIndex + delta + filteredOptions.length) % filteredOptions.length;
            setActiveIndex(nextIndex);
            scrollOptionIntoView(nextIndex);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (open && normalizedActiveIndex >= 0 && normalizedActiveIndex < filteredOptions.length) {
              const selected = filteredOptions[normalizedActiveIndex];
              setDraft(selected.value);
              onChange(selected.value);
              setOpen(false);
              setActiveIndex(-1);
              suppressBlurCommitRef.current = true;
              (e.target as HTMLInputElement).blur();
              return;
            }
            onChange(inputValue);
            setOpen(false);
            setActiveIndex(-1);
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
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraft(option.value);
                  onChange(option.value);
                  setOpen(false);
                  setActiveIndex(-1);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full text-left px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 ${
                  index === normalizedActiveIndex ? "bg-zinc-800" : ""
                }`}
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

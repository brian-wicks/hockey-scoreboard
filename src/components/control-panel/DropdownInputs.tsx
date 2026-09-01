import { useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PENALTY_OPTIONS } from "../../constants/penaltyOptions";

interface DropdownCoords {
  left: number;
  top: number;
  bottom: number;
}

export function useDropdownPlacement(open: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dropUp, setDropUp] = useState(false);
  const [maxHeight, setMaxHeight] = useState(224);
  // Viewport-relative coordinates for the popover, which is portalled to <body> (see
  // the callers below) rather than positioned with CSS `absolute` against this
  // container — a plain `absolute` popover only paints above elements within its own
  // stacking context, and every GlassPanel forms its own via backdrop-filter, so a
  // dropdown opened inside one panel would render *underneath* any GlassPanel that
  // happens to come later in the DOM (e.g. the Overlay panel after the team panels).
  const [coords, setCoords] = useState<DropdownCoords | null>(null);

  useLayoutEffect(() => {
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
      setCoords({ left: rect.left, top: rect.bottom + 4, bottom: window.innerHeight - rect.top + 4 });
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  return { containerRef, dropUp, maxHeight, coords };
}

// ---------------------------------------------------------------------------
// Shared searchable-combobox behavior (open/draft/active-index state, keyboard
// nav, blur/Enter/mouse commit, dropdown placement) used by PenaltyReasonInput
// and SearchDropdownInput below, and by PenaltyItem's player-number field.
// Each caller supplies how options are found for the current input text
// (getOptions), how a picked option becomes a value (getOptionValue), and how
// any candidate value — picked or freely typed — is actually committed
// (onCommit), which lets PenaltyItem normalize/match free text against a
// roster while the other two just pass the value straight through.
// ---------------------------------------------------------------------------

interface UseComboboxFieldArgs<T> {
  value: string;
  getOptions: (inputValue: string) => T[];
  getOptionValue: (option: T) => string;
  onCommit: (rawValue: string) => string;
}

export function useComboboxField<T>({ value, getOptions, getOptionValue, onCommit }: UseComboboxFieldArgs<T>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suppressBlurCommitRef = useRef(false);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { containerRef, dropUp, maxHeight, coords } = useDropdownPlacement(open);

  const inputValue = open ? draft : value;
  const options = getOptions(inputValue);

  const normalizedActiveIndex =
    open && options.length > 0 ? Math.min(Math.max(activeIndex, 0), options.length - 1) : -1;

  const scrollOptionIntoView = (index: number) => {
    if (!open || index < 0) return;
    requestAnimationFrame(() => {
      optionRefs.current[index]?.scrollIntoView({ block: "nearest" });
    });
  };

  const openWithFirstActive = () => {
    setOpen(true);
    if (options.length > 0) {
      setActiveIndex(0);
      scrollOptionIntoView(0);
    } else {
      setActiveIndex(-1);
    }
  };

  const commitAndClose = (rawValue: string) => {
    const committed = onCommit(rawValue);
    setDraft(committed);
    setOpen(false);
    setActiveIndex(-1);
    return committed;
  };

  const selectOption = (option: T) => {
    commitAndClose(getOptionValue(option));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
    setOpen(true);
    if (options.length > 0) {
      setActiveIndex(0);
      scrollOptionIntoView(0);
    }
  };

  const handleFocus = () => {
    setDraft(value);
    openWithFirstActive();
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (suppressBlurCommitRef.current) {
      suppressBlurCommitRef.current = false;
      return;
    }
    commitAndClose(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!open) {
        openWithFirstActive();
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
        selectOption(options[normalizedActiveIndex]);
        suppressBlurCommitRef.current = true;
        (e.target as HTMLInputElement).blur();
        return;
      }
      commitAndClose((e.target as HTMLInputElement).value);
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleOptionMouseDown = (option: T) => (e: React.MouseEvent) => {
    e.preventDefault();
    selectOption(option);
  };

  return {
    containerRef,
    open,
    inputValue,
    options,
    normalizedActiveIndex,
    dropUp,
    maxHeight,
    coords,
    optionRefs,
    handleChange,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleOptionMouseDown,
    setActiveIndex,
  };
}

export function ComboboxDropdown<T>({
  open,
  coords,
  dropUp,
  maxHeight,
  options,
  activeIndex,
  optionRefs,
  onOptionMouseDown,
  onOptionMouseEnter,
  getOptionKey,
  renderOption,
  widthClassName = "w-56",
  emptyLabel = "No matches",
}: {
  open: boolean;
  coords: DropdownCoords | null;
  dropUp: boolean;
  maxHeight: number;
  options: T[];
  activeIndex: number;
  optionRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
  onOptionMouseDown: (option: T) => (e: React.MouseEvent) => void;
  onOptionMouseEnter: (index: number) => void;
  getOptionKey: (option: T, index: number) => string;
  renderOption: (option: T) => ReactNode;
  widthClassName?: string;
  emptyLabel?: string;
}) {
  if (!open || !coords) return null;

  return createPortal(
    <div
      className={`fixed z-50 ${widthClassName} overflow-auto rounded-md border border-white/10 bg-zinc-950/95 backdrop-blur-sm shadow-lg`}
      style={{
        left: coords.left,
        maxHeight: `${maxHeight}px`,
        ...(dropUp ? { bottom: coords.bottom } : { top: coords.top }),
      }}
    >
      {options.length === 0 ? (
        <div className="px-2 py-1 text-xs text-zinc-500">{emptyLabel}</div>
      ) : (
        options.map((option, index) => (
          <button
            key={getOptionKey(option, index)}
            type="button"
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
            onMouseDown={onOptionMouseDown(option)}
            onMouseEnter={() => onOptionMouseEnter(index)}
            className={`w-full text-left px-2 py-1 text-xs text-zinc-200 hover:bg-white/[0.08] ${
              index === activeIndex ? "bg-white/[0.08]" : ""
            }`}
          >
            {renderOption(option)}
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}

interface PenaltyReasonInputProps {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  /** Class for the wrapping container div. Pass "relative flex-1 min-w-0" when this
   * needs to grow to fill a flex row (e.g. alongside a fixed-width button) — a bare
   * "relative" div has no intrinsic width, so an inputClassName of "w-full" alone
   * won't actually fill the row without this. Defaults to "relative". */
  containerClassName?: string;
}

export function PenaltyReasonInput({ value, onChange, inputClassName, containerClassName = "relative" }: PenaltyReasonInputProps) {
  const combobox = useComboboxField({
    value,
    getOptions: (inputValue) => {
      const normalized = inputValue.trim().toLowerCase();
      return PENALTY_OPTIONS.filter(
        (option) => !normalized || option.code.toLowerCase().includes(normalized) || option.label.toLowerCase().includes(normalized),
      );
    },
    getOptionValue: (option) => option.code,
    onCommit: (rawValue) => {
      onChange(rawValue);
      return rawValue;
    },
  });

  return (
    <div ref={combobox.containerRef} className={containerClassName}>
      <input
        value={combobox.inputValue}
        onChange={combobox.handleChange}
        onFocus={combobox.handleFocus}
        onBlur={combobox.handleBlur}
        onKeyDown={combobox.handleKeyDown}
        className={inputClassName}
        placeholder="Infraction"
      />
      <ComboboxDropdown
        open={combobox.open}
        coords={combobox.coords}
        dropUp={combobox.dropUp}
        maxHeight={combobox.maxHeight}
        options={combobox.options}
        activeIndex={combobox.normalizedActiveIndex}
        optionRefs={combobox.optionRefs}
        onOptionMouseDown={combobox.handleOptionMouseDown}
        onOptionMouseEnter={combobox.setActiveIndex}
        getOptionKey={(option) => option.code}
        renderOption={(option) => (
          <>
            <span className="font-mono">{option.code}</span>
            <span className="text-zinc-400"> - {option.label}</span>
          </>
        )}
      />
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
  containerClassName = "relative",
}: {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  placeholder: string;
  options: SearchOption[];
  /** Class for the wrapping container div. Pass "relative flex-1 min-w-0" when this
   * needs to grow to fill a flex row (e.g. alongside a fixed-width button) — a bare
   * "relative" div has no intrinsic width, so an inputClassName of "w-full" alone
   * won't actually fill the row without this. Defaults to "relative". */
  containerClassName?: string;
}) {
  const combobox = useComboboxField({
    value,
    getOptions: (inputValue) => {
      const normalized = inputValue.trim().toLowerCase();
      if (!normalized) return options;
      return options.filter(
        (option) => option.value.toLowerCase().includes(normalized) || (option.label ?? "").toLowerCase().includes(normalized),
      );
    },
    getOptionValue: (option) => option.value,
    onCommit: (rawValue) => {
      onChange(rawValue);
      return rawValue;
    },
  });

  return (
    <div ref={combobox.containerRef} className={containerClassName}>
      <input
        value={combobox.inputValue}
        onChange={combobox.handleChange}
        onFocus={combobox.handleFocus}
        onBlur={combobox.handleBlur}
        onKeyDown={combobox.handleKeyDown}
        className={inputClassName}
        placeholder={placeholder}
      />
      <ComboboxDropdown
        open={combobox.open}
        coords={combobox.coords}
        dropUp={combobox.dropUp}
        maxHeight={combobox.maxHeight}
        options={combobox.options}
        activeIndex={combobox.normalizedActiveIndex}
        optionRefs={combobox.optionRefs}
        onOptionMouseDown={combobox.handleOptionMouseDown}
        onOptionMouseEnter={combobox.setActiveIndex}
        getOptionKey={(option, index) => `${option.value}-${index}`}
        renderOption={(option) => (
          <>
            <span className="font-mono">{option.value}</span>
            {option.label ? <span className="text-zinc-400"> - {option.label}</span> : null}
          </>
        )}
      />
    </div>
  );
}

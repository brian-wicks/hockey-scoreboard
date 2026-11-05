import { InputHTMLAttributes, useState } from "react";

interface CommitInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  onCommit: (value: string) => void;
}

/**
 * A text box for live game data. While it has focus it shows what's being typed and ignores
 * updates from the server, then sends the text once on blur or Enter. Esc cancels.
 */
export function CommitInput({ value, onCommit, onFocus, onBlur, onKeyDown, ...rest }: CommitInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      {...rest}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => {
        setDraft(value);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (draft !== null && draft !== value) onCommit(draft);
        setDraft(null);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setDraft(value);
          // The blur handler reads the draft from this render, so finish on the next one.
          const input = event.currentTarget;
          requestAnimationFrame(() => input.blur());
        }
        onKeyDown?.(event);
      }}
    />
  );
}

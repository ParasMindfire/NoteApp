import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  function handleChange(index: number, char: string) {
    if (!/^\d$/.test(char)) return;
    const next = [...digits];
    next[index] = char;
    onChange(next.join('').trimEnd());
    if (index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        onChange(next.join('').trimEnd());
      } else if (index > 0) {
        next[index - 1] = '';
        onChange(next.join('').trimEnd());
        inputsRef.current[index - 1]?.focus();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const nextIndex = Math.min(pasted.length, 5);
    inputsRef.current[nextIndex]?.focus();
  }

  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="sr-only">One-time password — 6 digits</legend>
      <div className="flex gap-2 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i] ?? ''}
            aria-label={`Digit ${i + 1} of 6`}
            disabled={disabled}
            className={cn(
              'w-10 h-12 text-center text-lg font-mono rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
            )}
            onChange={(e) => handleChange(i, e.target.value.slice(-1))}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
          />
        ))}
      </div>
    </fieldset>
  );
}

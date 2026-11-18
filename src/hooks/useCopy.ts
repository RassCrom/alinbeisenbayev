import { useEffect, useRef, useState } from 'react';

/**
 * Copy text to the clipboard and remember which item was copied for a moment,
 * so the button can say so. Falls back to a prompt where the clipboard API is
 * missing or refused (an http page, an old browser).
 */
export function useCopy(resetMs = 1600) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (text: string, key: string = text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy this', text);
      return;
    }
    setCopied(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), resetMs);
  };

  return { copied, copy };
}

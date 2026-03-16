import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const RESET_DELAY_MS = 2500;

interface CopyButtonProps {
  content: string;
  className?: string;
  iconClassName?: string;
  size?: 'sm' | 'md';
  /** Called after successful copy */
  onCopied?: () => void;
}

export function CopyButton({
  content,
  className,
  iconClassName,
  size = 'md',
  onCopied,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopied?.();

      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        resetTimeoutRef.current = null;
      }, RESET_DELAY_MS);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [content, onCopied]);

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'p-1' : 'p-1.5';
  const innerSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center justify-center rounded-md hover:bg-neutral-700/80 text-neutral-400 hover:text-neutral-200 transition-colors',
        buttonSize,
        className
      )}
      title={copied ? 'Copied!' : 'Copy'}
      aria-label={copied ? 'Copied' : 'Copy'}
      aria-live="polite"
    >
      <span className={cn('relative inline-flex items-center justify-center', innerSize)}>
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={cn('absolute inset-0 grid place-items-center text-emerald-400', iconSize, iconClassName)}
            >
              <Check className={cn('shrink-0', iconSize, iconClassName)} strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={cn('absolute inset-0 grid place-items-center', iconSize, iconClassName)}
            >
              <Copy className={cn('shrink-0', iconSize, iconClassName)} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}

import { memo, useMemo, type JSX } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Shimmer component matching AI SDK Elements pattern:
 * https://elements.ai-sdk.dev/components/shimmer
 *
 * Animated text shimmer for loading states. Uses text-transparent + background-clip
 * for crisp rendering. Theme-aware via CSS custom properties.
 */
export interface TextShimmerProps {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

function TextShimmerComponent({
  children,
  as: Component = 'p',
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) {
  const MotionComponent = motion(Component as keyof JSX.IntrinsicElements);

  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  );

  return (
    <MotionComponent
      className={cn(
        'relative inline-block bg-[length:250%_100%,auto] bg-clip-text bg-no-repeat',
        'text-transparent',
        // Theme-aware: base (visible on dark) + highlight (sweep) — AI SDK Elements pattern
        '[--shimmer-base:#71717a] [--shimmer-highlight:#ffffff]',
        '[--shimmer-gradient:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--shimmer-highlight),#0000_calc(50%+var(--spread)))]',
        '[--bg-base:linear-gradient(var(--shimmer-base),var(--shimmer-base))]',
        className
      )}
      initial={{ backgroundPosition: '100% center' }}
      animate={{ backgroundPosition: '0% center' }}
      transition={{
        repeat: Infinity,
        duration,
        ease: 'linear',
      }}
      style={
        {
          '--spread': `${dynamicSpread}px`,
          backgroundImage: `var(--shimmer-gradient), var(--bg-base)`,
        } as React.CSSProperties
      }
    >
      {children}
    </MotionComponent>
  );
}

export const TextShimmer = memo(TextShimmerComponent);

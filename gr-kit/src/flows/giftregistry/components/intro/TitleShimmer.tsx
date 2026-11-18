import { useEffect, useRef } from 'react';
import { easing } from '../../../../motion/presets';
import styles from '../GiftRegistriesCard.module.css';

/**
 * One highlight sweep across a title's glyphs (reference flow 6: widget.js `runShimmer`, 1100 ms, 105° band of white
 * clipped to the text). Each new `run` (> 0) sweeps once. Driven by WAAPI on background-position: the band has to be
 * the text's own clipped background, which a transform can't move, and motion/react doesn't tween this property.
 * The curve is the kit's cubic in-out (a sweep should glide on and off, not race in and crawl out).
 */
export function TitleShimmer({ run, children }: { run: number; children: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!run || !node) return;
    const a = node.animate(
      [
        { backgroundPosition: '100% 0', opacity: 1 },
        { backgroundPosition: '0% 0', opacity: 1 },
      ],
      { duration: 1100, easing: `cubic-bezier(${easing.inOut.join(', ')})` },
    );
    return () => a.cancel();
  }, [run]);
  return (
    <span ref={el} className={styles.shimmer} aria-hidden>
      {children}
    </span>
  );
}

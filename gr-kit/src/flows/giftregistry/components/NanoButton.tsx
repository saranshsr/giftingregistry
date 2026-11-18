import { animate, motion, useMotionValue, type HTMLMotionProps, type Transition } from 'motion/react';
import { forwardRef, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { handoff } from '../../../motion/presets';
import { useReduceMotion } from '../../../motion/reducedMotion';
import { haptics } from '../haptics';
import type { Theme } from '../theme';
import styles from './NanoButton.module.css';

/**
 * nano Button v3, built to the handoff (Button_v3_Handoff.pdf, tokens.md): the dark primary slab, the white
 * secondary, the text tertiary, and the disabled state. One press motion and one haptic pair for the filled variants:
 *
 *   touch-down  scale 1 → 0.98 and y 0 → +0.5 on spring S1, the pressed face cross-fades in over 20 ms, haptic `press`
 *   touch-up    back on S1 from wherever it is (springs keep their velocity), the face fades out, haptic `release`
 *               (also when the press is cancelled by dragging out)
 *
 * Disabled: no surface, no press, no haptic; a flat muted fill. Disabled ⇄ enabled cross-fades over 200 ms, and
 * becoming enabled bumps 0.98 → 1 on the move spring ("Continue is now available").
 *
 * Colours: omit `colors` for the guide's neutral black. Pass an occasion's `nanoColors(theme)` (or set the
 * `--nano-btn-deep / -glow / -tint` CSS variables on any ancestor) to fill the same layers with the occasion.
 */

/** Spring S1: response 0.20 s, bounce 0.06 → stiffness (2π/T)² = 986.96, damping 4πζ/T = 59.06, mass 1 */
export const NANO_S1: Transition = { type: 'spring', stiffness: 986.96, damping: 59.06, mass: 1 };
/** PP Move, the 540 ms recorded spring (1.3% overshoot) the enable bump rides */
const MOVE_540: Transition = handoff.spring;
const PRESS_SCALE = 0.98;
const PRESS_DEPTH = 0.5;

export type NanoButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface NanoButtonColors {
  /** rest fill and the pressed radial's edge (the guide's #212121): the occasion's deep shade */
  deep: string;
  /** pressed radial centre (the guide's #424242); default: `deep` 15% toward white, the guide's own step */
  glow?: string;
  /** how far the guide's grey stroke / lip and black shadows lean toward the occasion (default 20%) */
  tint?: number;
}

/* the guide's pressed step: #424242 over #212121 is a 1.60 : 1 contrast ((L + 0.05) ratio); an occasion's glow keeps to it */
type RGB = [number, number, number];
const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const lum = (c: RGB) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: RGB, b: RGB) => (lum(a) + 0.05) / (lum(b) + 0.05);
const mixRGB = (a: RGB, b: RGB, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const hexOf = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const GUIDE_STEP = contrast(rgb('#424242'), rgb('#212121')); // token-lint-ignore — the guide's pressed centre / rest fill

/**
 * An occasion theme's CTA shades as button colours. Rest fill = the deep shade (`ctaA`); the pressed centre = the
 * edge shade (`ctaB`), pulled back toward the deep shade only as far as needed to keep the guide's pressed step (a
 * 1.60 : 1 lift), so a bright edge like Eid's amber doesn't light the button up. Default (no occasion) → undefined,
 * the guide's neutral black.
 */
export function nanoColors(theme: Pick<Theme, 'key' | 'ctaA' | 'ctaB'>): NanoButtonColors | undefined {
  if (theme.key === 'default') return undefined;
  const deep = rgb(theme.ctaA),
    edge = rgb(theme.ctaB);
  if (contrast(edge, deep) <= GUIDE_STEP) return { deep: theme.ctaA, glow: theme.ctaB };
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 16; i++) {
    const t = (lo + hi) / 2;
    if (contrast(mixRGB(deep, edge, t), deep) > GUIDE_STEP) hi = t;
    else lo = t;
  }
  return { deep: theme.ctaA, glow: hexOf(mixRGB(deep, edge, lo)) };
}

export interface NanoButtonProps extends Omit<HTMLMotionProps<'button'>, 'children' | 'disabled' | 'color'> {
  variant?: NanoButtonVariant;
  /** aria-disabled (the button stays focusable): no surface, no press, no haptic, `onClick` doesn't fire */
  disabled?: boolean;
  /** a tap on the disabled button (e.g. the invalid-CTA shake); no press visual and no haptic of its own */
  onDisabledClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** occasion colours for the primary; omit for the guide's neutral */
  colors?: NanoButtonColors;
  /** tertiary label colour (guide #7924FF) */
  ink?: string;
  /** play press / release (default true; tertiary leaves its tap to the flow's tap listener) */
  haptic?: boolean;
  /** pin the pressed look (screenshots, specs) */
  pressHeld?: boolean;
  children: ReactNode;
}

export const NanoButton = forwardRef<HTMLButtonElement, NanoButtonProps>(function NanoButton(
  {
    variant = 'primary',
    disabled = false,
    onDisabledClick,
    colors,
    ink,
    haptic = true,
    pressHeld = false,
    className,
    style,
    onClick,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onKeyDown,
    onKeyUp,
    onBlur,
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  const reduce = useReduceMotion();
  const filled = variant !== 'tertiary';
  const scale = useMotionValue(1);
  const y = useMotionValue(0);
  const [pressed, setPressed] = useState(false);
  const down = useRef(false);

  const press = () => {
    if (disabled || down.current) return;
    down.current = true;
    setPressed(true);
    if (filled && !reduce) {
      animate(scale, PRESS_SCALE, NANO_S1);
      animate(y, PRESS_DEPTH, NANO_S1);
    }
    if (haptic && filled) haptics.press();
  };
  const release = () => {
    if (!down.current) return;
    down.current = false;
    setPressed(false);
    if (filled) {
      animate(scale, 1, NANO_S1);
      animate(y, 0, NANO_S1);
    }
    if (haptic && filled) haptics.release();
  };

  // becoming disabled mid-press drops the press; becoming enabled bumps 0.98 → 1 on the move spring
  const wasDisabled = useRef(disabled);
  useEffect(() => {
    if (disabled && down.current) release();
    if (wasDisabled.current && !disabled && filled && !reduce) {
      scale.jump(PRESS_SCALE);
      animate(scale, 1, MOVE_540);
    }
    wasDisabled.current = disabled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const vars: Record<string, string> = {};
  if (colors && variant === 'primary') {
    vars['--nano-btn-deep'] = colors.deep;
    if (colors.glow) vars['--nano-btn-glow'] = colors.glow;
    vars['--nano-btn-tint'] = `${colors.tint ?? 20}%`;
  }
  if (ink) vars['--nb-ink'] = ink;

  const isPressed = (pressed || pressHeld) && !disabled;

  return (
    <motion.button // design-ignore — the nano Button v3 itself (press springs + layered faces), not a raw CTA
      ref={ref}
      type={type}
      {...rest}
      className={[styles.root, filled && styles.filled, styles[variant], className].filter(Boolean).join(' ')}
      style={{ ...(style as CSSProperties), ...(vars as CSSProperties), scale, y }}
      aria-disabled={disabled || undefined}
      data-variant={variant}
      data-pressed={isPressed ? '' : undefined}
      // the filled variants play their own press / release, so the flow's tap listener stands down
      data-haptic={filled && haptic ? 'off' : undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (disabled) {
          e.preventDefault();
          onDisabledClick?.(e);
          return;
        }
        onClick?.(e);
      }}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        onPointerDown?.(e);
        if (e.button !== 0) return;
        // touch / pen capture the pointer implicitly; release it so dragging out cancels the press
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        press();
      }}
      onPointerUp={(e: PointerEvent<HTMLButtonElement>) => {
        onPointerUp?.(e);
        release();
      }}
      onPointerCancel={(e: PointerEvent<HTMLButtonElement>) => {
        onPointerCancel?.(e);
        release();
      }}
      onPointerLeave={(e: PointerEvent<HTMLButtonElement>) => {
        onPointerLeave?.(e);
        release();
      }}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(e);
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) press();
      }}
      onKeyUp={(e: KeyboardEvent<HTMLButtonElement>) => {
        onKeyUp?.(e);
        if (e.key === 'Enter' || e.key === ' ') release();
      }}
      onBlur={(e) => {
        onBlur?.(e);
        release();
      }}
    >
      {filled && (
        <span className={styles.surface} aria-hidden>
          <span className={`${styles.face} ${styles.rest}`}>
            <span className={`${styles.layer} ${styles.fill}`} />
            <span className={`${styles.layer} ${styles.shadows}`} />
            {variant === 'primary' && <span className={`${styles.layer} ${styles.stroke}`} />}
          </span>
          <span className={`${styles.face} ${styles.pressedFace}`}>
            <span className={`${styles.layer} ${styles.fill}`} />
            <span className={`${styles.layer} ${styles.shadows}`} />
            {variant === 'primary' && <span className={`${styles.layer} ${styles.stroke}`} />}
          </span>
          {/* white: one stroke over both faces, unchanged by the press */}
          {variant === 'secondary' && (
            <span className={`${styles.face} ${styles.keepStroke}`}>
              <span className={`${styles.layer} ${styles.stroke}`} />
            </span>
          )}
          <span className={styles.muted} />
        </span>
      )}
      <span className={styles.label}>{children}</span>
    </motion.button>
  );
});

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { fade, MOVE, SHEET_OPEN } from '../motion';
import styles from './IosDatePicker.module.css';

/**
 * "Pick from calendar" opens the system date picker.
 * - Touch devices (iPhone, Android, prototype-player webviews): a real `<input type="date">` laid invisibly over the
 *   chip (`chipInput`), so the finger lands on the input itself and the OS opens its own date picker. Opening a hidden
 *   input from script (`showPicker()`, focus / click) is ignored by iOS and many webviews, which is why the chip did
 *   nothing there. `min` is today.
 * - Desktop (no native iOS picker): a stand-in drawn like iOS 17's compact date picker popover with the inline calendar
 *   (month / year header with chevrons, weekday row, the picked day in the tint), the system font and material, and
 *   the iOS popover motion: a quick scale-and-fade from the chip.
 * Either way `onPick` gets the chosen day; dismissing without a pick changes nothing.
 */
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface IosDatePickerHandle {
  open: (anchor: HTMLElement | null) => void;
}

export function useIosDatePicker({ value, tint, onPick }: { value: Date | null; tint: string; onPick: (d: Date) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // touch: the overlay input already took the tap and the OS picker is opening, so the chip has nothing more to do
  const open = (el: HTMLElement | null) => {
    if (TOUCH) return;
    setAnchor(el?.getBoundingClientRect() ?? null);
  };

  const chipInput = TOUCH ? (
    <input
      ref={input}
      type="date"
      className={styles.native}
      min={isoOf(today)}
      value={value ? isoOf(value) : ''}
      aria-label="Pick from calendar"
      onChange={(e) => {
        const v = e.currentTarget.value;
        if (!v) return;
        const [y, m, d] = v.split('-').map(Number);
        onPick(new Date(y, m - 1, d));
      }}
    />
  ) : null;

  const node = (
    <AnimatePresence>
      {anchor && (
        <Popover
          key="pop"
          anchor={anchor}
          value={value}
          today={today}
          tint={tint}
          onClose={() => setAnchor(null)}
          onPick={(d) => {
            onPick(d);
            // iOS keeps the popover a beat so the pick registers, then it goes
            setTimeout(() => setAnchor(null), 220);
          }}
        />
      )}
    </AnimatePresence>
  );
  return { open, node, chipInput };
}

const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function Popover({
  anchor,
  value,
  today,
  tint,
  onClose,
  onPick,
}: {
  anchor: DOMRect;
  value: Date | null;
  today: Date;
  tint: string;
  onClose: () => void;
  onPick: (d: Date) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const start = value && value >= today ? value : new Date(today.getTime() + 30 * 864e5);
  const [month, setMonth] = useState(new Date(start.getFullYear(), start.getMonth(), 1));
  const [picked, setPicked] = useState<Date | null>(value);
  const [place, setPlace] = useState<{ left: number; top: number; originX: number; originY: number } | null>(null);

  // position against the phone (the popover's offset parent): centred on the chip, above it when there is no room below
  useEffect(() => {
    const host = box.current?.offsetParent as HTMLElement | null;
    if (!host) return;
    const H = host.getBoundingClientRect();
    const k = H.width / host.offsetWidth || 1;
    const W = 320,
      PH = 352;
    const cx = (anchor.left + anchor.width / 2 - H.left) / k;
    const below = (anchor.bottom - H.top) / k + 8;
    const above = (anchor.top - H.top) / k - 8 - PH;
    const top = below + PH < host.offsetHeight - 40 ? below : Math.max(54, above);
    const left = Math.min(Math.max(12, cx - W / 2), host.offsetWidth - W - 12);
    setPlace({ left, top, originX: cx - left, originY: top === below ? 0 : PH });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const canPrev = month > new Date(today.getFullYear(), today.getMonth(), 1);
  const label = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      <motion.div className={styles.dismiss} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade(0.18)} onPointerDown={onClose} />
      <motion.div
        ref={box}
        role="dialog"
        aria-label="Choose a date"
        className={styles.popover}
        style={{ left: place?.left ?? -9999, top: place?.top ?? 0, transformOrigin: place ? `${place.originX}px ${place.originY}px` : '50% 0', '--tint': tint } as CSSProperties}
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
        transition={{ ...SHEET_OPEN, opacity: fade(0.16) }}
      >
        <div className={styles.head}>
          <span className={styles.month}>
            {label}
            <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden>
              <path d="M1.5 1.5 6.5 6.5 1.5 11.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className={styles.nav}>
            <button /* design-ignore — iOS system control stand-in */
              type="button"
              aria-label="Previous month"
              disabled={!canPrev}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden>
                <path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button /* design-ignore — iOS system control stand-in */
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden>
                <path d="m2 2 8 8-8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </span>
        </div>
        <div className={styles.week}>
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className={styles.grid}>
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const date = new Date(month.getFullYear(), month.getMonth(), d);
            const past = date < today;
            const sel = !!picked && picked.getTime() === date.getTime();
            const isToday = date.getTime() === today.getTime();
            return (
              <button /* design-ignore — iOS system control stand-in */
                key={d}
                type="button"
                className={styles.day}
                data-selected={sel || undefined}
                data-today={isToday || undefined}
                disabled={past}
                aria-label={date.toDateString()}
                onClick={() => {
                  setPicked(date);
                  onPick(date);
                }}
              >
                {sel && <motion.span layoutId="ios-day" className={styles.disc} transition={MOVE} />}
                <span className={styles.num}>{d}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}

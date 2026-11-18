import { animate, motion, useMotionValue } from 'motion/react';
import { memo, useLayoutEffect, useRef, useState } from 'react';
import { Pressable } from '../../../../components';
import { fade, fadeOut, MOVE } from '../../motion';
import styles from './MonthGrid.module.css';

/**
 * One month of the "Pick from calendar" sheet (reference createCalendar): a seven-column grid of 44 pt day discs on
 * 50 pt rows, the month label above it. Past days are disabled (#D0D4DD), today carries the reference's small action
 * dot under its digit, and the picked day sits on the accent disc with a white SemiBold digit.
 *
 * The disc is one element per month. It lands on the first pick (scale 0.6 → 1, its fade 0.18 s ease-out), glides
 * between days of the same month on the MOVE spring, and recedes (0.6, 0.16 s fade) when the pick moves to another
 * month. A month that mounts with the pick already in it shows the disc without motion (reference `choose(d, true)`).
 */
export interface MonthGridProps {
  /** first day of the month */
  month: Date;
  /** day of this month that is picked, or null */
  picked: number | null;
  /** midnight today */
  today: Date;
  accent: string;
  reduce: boolean;
  onPick: (date: Date) => void;
}

const ROW = 50;

export const MonthGrid = memo(function MonthGrid({ month, picked, today, accent, reduce, onPick }: MonthGridProps) {
  const y = month.getFullYear(),
    m = month.getMonth();
  const lead = month.getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const rows = Math.ceil((lead + days) / 7);
  const label = month.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const at = (d: number) => ({ col: (d - 1 + lead) % 7, row: Math.floor((d - 1 + lead) / 7) });
  const sel = picked != null ? at(picked) : null;
  const isThisMonth = today.getFullYear() === y && today.getMonth() === m;
  // column width in px (the grid is fluid), so the disc moves on a plain transform
  const grid = useRef<HTMLDivElement>(null);
  const [colW, setColW] = useState(0);
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setColW(el.offsetWidth / 7));
    ro.observe(el);
    setColW(el.offsetWidth / 7);
    return () => ro.disconnect();
  }, []);
  // the disc glides only when it is already showing in this month; arriving, it starts on its day and scales in
  const dx = useMotionValue(0),
    dy = useMotionValue(0);
  const shown = useRef(false);
  const tx = sel ? sel.col * colW : null,
    ty = sel ? sel.row * ROW : null;
  useLayoutEffect(() => {
    if (tx == null || ty == null) {
      shown.current = false;
      return;
    }
    if (shown.current && !reduce) {
      const a = animate(dx, tx, MOVE),
        b = animate(dy, ty, MOVE);
      shown.current = true;
      return () => {
        a.stop();
        b.stop();
      };
    }
    dx.set(tx);
    dy.set(ty);
    shown.current = true;
  }, [tx, ty, reduce, dx, dy]);

  return (
    <section className={styles.month} aria-label={label}>
      <h3 className={styles.label}>{label}</h3>
      <div ref={grid} className={styles.grid} style={{ height: rows * ROW }}>
        <motion.span className={styles.discTrack} aria-hidden style={{ x: dx, y: dy }}>
          <motion.span
            className={styles.disc}
            style={{ background: accent }}
            initial={false}
            animate={sel ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
            transition={reduce ? { duration: 0 } : sel ? { ...MOVE, opacity: fade(0.18) } : { ...MOVE, opacity: fadeOut(0.16) }}
          />
        </motion.span>
        {Array.from({ length: days }, (_, k) => {
          const d = k + 1;
          const date = new Date(y, m, d);
          const past = date < today;
          const isToday = isThisMonth && d === today.getDate();
          const on = picked === d;
          const { col, row } = at(d);
          return (
            <Pressable
              key={d}
              className={styles.day}
              data-selected={on || undefined}
              data-today={isToday || undefined}
              disabled={past}
              scale={0.96}
              style={{ gridColumn: col + 1, gridRow: row + 1 }}
              onClick={() => onPick(date)}
              aria-label={date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              aria-pressed={on}
              aria-current={isToday ? 'date' : undefined}
            >
              <span className={styles.digit}>{d}</span>
            </Pressable>
          );
        })}
      </div>
    </section>
  );
});

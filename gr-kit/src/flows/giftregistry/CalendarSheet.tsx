/* NOT ROUTED: "Pick from calendar" now opens the system date picker (components/IosDatePicker). Kept for reference. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { OriginIcon, Pressable, SheetBody, SheetFooter, SheetHeader } from '../../components';
import { useNav } from '../../kit/Navigator';
import { useReduceMotion } from '../../motion/reducedMotion';
import { MonthGrid } from './components/sheets/MonthGrid';
import { copy } from './data';
import { grStore } from './store';
import { themeOf } from './theme';
import styles from './sheets.module.css';

/**
 * "Pick from calendar" (reference createCalendar, Figma "When is the event?"), a kit Origin sheet.
 *
 * Layout follows the reference: title + year pill, a pinned Su–Sa row, then the months scroll under it (label left,
 * 44 pt discs on 50 pt rows). Past days are disabled, today has the action dot. The picked day sits on a disc in the
 * occasion's CTA colour (reference `REG_BUTTON[theme].edge` = theme.ctaB): it lands 0.6 → 1, glides between days on
 * MOVE. Confirm (filled with the same colour) wakes over 0.2 s once a day is picked and writes the date into the
 * step's dd mm yyyy field. Close / the grabber / the scrim leave without changing anything.
 */
const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
/** months offered from the current one */
const SPAN = 12;

export function CalendarSheet() {
  const nav = useNav();
  const reduce = useReduceMotion();
  const { digits, occ } = grStore.useStore((s) => s);
  const theme = themeOf(occ);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const initial = useMemo(() => {
    if (digits.length !== 8) return null;
    const d = new Date(+digits.slice(4), +digits.slice(2, 4) - 1, +digits.slice(0, 2));
    return !Number.isNaN(d.getTime()) && d.getDate() === +digits.slice(0, 2) && d >= today ? d : null;
    // the sheet reads the field once, as it opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pick, setPick] = useState<Date | null>(initial);
  const months = useMemo(() => Array.from({ length: SPAN }, (_, i) => new Date(today.getFullYear(), today.getMonth() + i, 1)), [today]);
  const [year, setYear] = useState(() => (initial ?? today).getFullYear());

  // open on the month that holds the date already in the field
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !initial) return;
    const i = (initial.getFullYear() - today.getFullYear()) * 12 + initial.getMonth() - today.getMonth();
    const sec = el.querySelectorAll('section')[i] as HTMLElement | undefined;
    if (sec) el.scrollTop = sec.offsetTop;
  }, [initial, today]);
  // the year pill follows the month at the top of the list
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const secs = el.querySelectorAll('section');
    let i = 0;
    secs.forEach((s, k) => {
      if ((s as HTMLElement).offsetTop - el.scrollTop <= 40) i = k;
    });
    const y = months[i]?.getFullYear();
    if (y && y !== year) setYear(y);
  };

  const confirm = () => {
    if (!pick) return;
    const p = (n: number) => String(n).padStart(2, '0');
    grStore.patch({ digits: p(pick.getDate()) + p(pick.getMonth() + 1) + pick.getFullYear(), dateConfirmedAt: Date.now() });
    nav.back();
  };

  const vars = { '--cal-accent': theme.ctaB } as CSSProperties;
  return (
    <>
      <SheetHeader
        title={copy.calendar.title}
        trailing={
          <Pressable className={styles.yearPill} scale={0.96} onClick={() => nav.toast('The year picker isn’t in this prototype')} aria-label={`Year ${year}`}>
            {year}
            <OriginIcon name="chevron-down" size={16} color="var(--nk-field-text-primary)" />
          </Pressable>
        }
      />
      <SheetBody className={styles.calBody}>
        <div className={styles.week} aria-hidden>
          {WEEK.map((w) => (
            <span key={w} className={styles.weekday}>
              {w}
            </span>
          ))}
        </div>
        <div ref={scroller} className={`nk-scroll ${styles.months}`} onScroll={onScroll}>
          {months.map((m) => (
            <MonthGrid
              key={m.getTime()}
              month={m}
              picked={pick && pick.getFullYear() === m.getFullYear() && pick.getMonth() === m.getMonth() ? pick.getDate() : null}
              today={today}
              accent={theme.ctaB}
              reduce={reduce}
              onPick={setPick}
            />
          ))}
        </div>
      </SheetBody>
      {/* display: contents, so the bar keeps its place in the sheet; the vars restyle its Confirm in the occasion colour */}
      <div className={styles.calFooter} style={vars}>
        <SheetFooter
          layout="split"
          tone="neutral"
          secondary={{ label: copy.calendar.close, onPress: () => nav.back() }}
          primary={{ label: copy.calendar.confirm, onPress: confirm, disabled: !pick }}
        />
      </div>
    </>
  );
}

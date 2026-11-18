import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Button, OriginIcon, Pressable } from '../components';
import { duration, easing, fieldMotion } from '../motion/presets';
import type { Route } from '../kit/types';
import { NoonThemeProvider } from '../foundations/ThemeProvider';
import type { ReviewFlow } from './reviewFlows';
import styles from './FlowSelector.module.css';

/**
 * Review-page flow selector (dev preview shell, not part of the package). Collapsed to a small handle so the review
 * stays one phone. Desktop: the handle opens a slim side panel. Phone-sized windows (the proto full screen): it opens
 * as a bottom sheet over the app with a grabber. Lists the groups and flows it is given; entries whose flow is not
 * registered yet show as "Coming next" and can't be opened. Restart reloads the current flow from its start.
 */
export function FlowSelector({
  title,
  groups,
  current,
  isAvailable,
  onOpen,
  onRestart,
}: {
  title: string;
  groups: { label: string; flows: ReviewFlow[] }[];
  /** the route on screen (flow/screen) */
  current?: Route;
  isAvailable: (route: Route) => boolean;
  onOpen: (f: ReviewFlow) => void;
  onRestart: () => void;
}) {
  const [open, setOpen] = useState(false);
  const phone = useNarrow();
  const flowOf = (r?: string) => r?.split('/')[0];
  const currentId = groups.flatMap((g) => g.flows).find((f) => flowOf(f.route) === flowOf(current))?.id;

  const list = (
    <div className={styles.list}>
      <div className={styles.title}>{title}</div>
      {groups.map((g) => (
        <section key={g.label} className={styles.group}>
          <div className={styles.groupLabel}>{g.label}</div>
          {g.flows.map((f) => {
            const live = isAvailable(f.route);
            const on = f.id === currentId;
            return (
              <Pressable
                key={f.id}
                className={styles.row}
                data-current={on || undefined}
                data-soon={!live || undefined}
                disabled={!live}
                scale={live ? 0.98 : 1}
                onClick={() => {
                  setOpen(false);
                  if (!on) onOpen(f);
                }}
                aria-current={on || undefined}
              >
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{f.title}</span>
                  <span className={styles.rowSub}>{live ? f.subtitle : `${f.subtitle} · Coming next`}</span>
                </span>
                {on && <span className={styles.dot} aria-hidden />}
              </Pressable>
            );
          })}
        </section>
      ))}
      <div className={styles.restart}>
        <Button variant="fieldSecondaryNeutral" fieldSize="H40" block onClick={onRestart}>
          Restart flow
        </Button>
      </div>
    </div>
  );

  const fadeT = { duration: duration.base, ease: easing.out };
  return (
    // the selector sits outside the phone, so it brings its own token scope
    <NoonThemeProvider className={styles.scope}>
      <AnimatePresence>
        {!open && (
          <motion.div key="handle" className={phone ? styles.handlePhone : styles.handle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fadeT}>
            <Pressable className={styles.handleBtn} onClick={() => setOpen(true)} aria-label="Flows" scale={0.94}>
              <OriginIcon name="sort" size={phone ? 16 : 18} color="var(--nk-color-text-primary)" />
              {!phone && <span className={styles.handleLabel}>Flows</span>}
            </Pressable>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && phone && (
          <motion.div key="sheet" className={styles.sheetLayer} initial="hidden" animate="shown" exit="hidden">
            <motion.div className={styles.scrim} variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }} transition={fadeT} onClick={() => setOpen(false)} />
            <motion.div className={styles.sheet} variants={{ hidden: { y: '100%' }, shown: { y: 0 } }} transition={fieldMotion.spring.springLight}>
              <div className={styles.grabber} />
              {list}
            </motion.div>
          </motion.div>
        )}
        {open && !phone && (
          <motion.aside key="panel" className={styles.panel} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -16, opacity: 0 }} transition={{ ...fieldMotion.spring.springLight, opacity: fadeT }}>
            <Pressable className={styles.collapse} onClick={() => setOpen(false)} aria-label="Hide flows" scale={0.94}>
              <OriginIcon name="chevron-left" size={18} color="var(--nk-color-text-secondary)" />
            </Pressable>
            {list}
          </motion.aside>
        )}
      </AnimatePresence>
    </NoonThemeProvider>
  );
}

function useNarrow() {
  const q = '(max-width: 600px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

import styles from './NewTag.module.css';

/**
 * Figma "New Badge" (Zs6qEAZ1Uaej4LcKst0sbp · I843:720014;8009:314310, 38 × 18): green fill from #19CB83 at the top to
 * the kit success green at the bottom, r12, 2 / 6 padding, B11 Bold white. Used on the Account card and the Create
 * sheet's registry card.
 */
export function NewTag({ children = 'NEW' }: { children?: string }) {
  return <span className={styles.tag}>{children}</span>;
}

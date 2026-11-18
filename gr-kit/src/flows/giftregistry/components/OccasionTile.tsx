import type { CSSProperties } from 'react';
import { Pressable } from '../../../components';
import { occArt } from '../assets';
import type { Occasion } from '../data';
import { tileColours } from '../theme';
import styles from './OccasionTile.module.css';

/**
 * Occasion tile (Figma "Option BG" 1379:1094064 + occasion art; reference createOccasionTile, flow 6 `occ-v2 occ-v5`).
 * 98 × 120 on the subtle fill. Selected: white fill, 1 px stroke, a 202 pt glow ellipse rising into place, bold label
 * and a small art lift, each in the tile's own occasion colours (reference REG_TILE_THEME). Press: kit Pressable.
 */
export function OccasionTile({ occasion, selected, onSelect, style }: { occasion: Occasion; selected: boolean; onSelect: () => void; style?: CSSProperties }) {
  const c = tileColours(occasion.key);
  return (
    <Pressable
      className={styles.tile}
      data-selected={selected || undefined}
      aria-pressed={selected}
      aria-label={occasion.label}
      onClick={onSelect}
      style={{ ...style, '--occ-stroke': c.stroke, '--occ-glow': c.glow, '--occ-label': c.label } as CSSProperties}
    >
      <span className={styles.bg} />
      <span className={styles.glow} />
      <span className={styles.label}>{occasion.label}</span>
      <img className={styles.art} src={occArt(occasion.key)} alt="" />
    </Pressable>
  );
}

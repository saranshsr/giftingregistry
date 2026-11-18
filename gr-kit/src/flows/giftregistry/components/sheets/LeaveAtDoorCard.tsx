import { useAnimate } from 'motion/react';
import { Checkbox, OriginIcon, Pressable } from '../../../../components';
import { useReduceMotion } from '../../../../motion/reducedMotion';
import { MOVE } from '../../motion';
import styles from './LeaveAtDoorCard.module.css';

/**
 * "Leave at door" (reference flow 4 Delivery details, `regLeaveAtDoor` + the s3-instr card; flow 6 drops it, the
 * user keeps it): a surface/secondary r12 card, door on a white tile, label, kit Field Checkbox 20. The whole card toggles.
 *
 * Motion: the reference fades its checked picture in over .15 s and scales it .6 → 1 over .25 s. The kit Checkbox
 * keeps its own check-in (fill fade + tick draw); on checking, the box also settles from 0.85 on the MOVE spring, a
 * quieter version of the reference's pop with no overshoot. Unchecking only fades (kit recede).
 */
export interface LeaveAtDoorCardProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function LeaveAtDoorCard({ checked, onChange, label = 'Leave at door' }: LeaveAtDoorCardProps) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const reduce = useReduceMotion();
  const toggle = () => {
    const next = !checked;
    if (next && !reduce && scope.current) animate(scope.current, { scale: [0.85, 1] }, MOVE);
    onChange(next);
  };
  return (
    <Pressable className={styles.card} scale={0.98} onClick={toggle} role="checkbox" aria-checked={checked} aria-label={label}>
      <span className={styles.icon}>
        <OriginIcon name="door" size={20} color="var(--nk-field-text-primary)" />
      </span>
      <span className={styles.label}>{label}</span>
      <span ref={scope} className={styles.box}>
        <Checkbox variant="field" size={20} checked={checked} />
      </span>
    </Pressable>
  );
}

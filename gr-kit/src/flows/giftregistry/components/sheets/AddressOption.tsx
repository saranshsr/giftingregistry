import { DashedDivider, ListRow, OriginIcon, Pressable, Radio } from '../../../../components';
import styles from './AddressOption.module.css';

/**
 * A saved address in the address sheet (reference address-card-*.png, Figma "Address edit" 1407:1700960): white r12
 * card, a kit Field ListRow header (icon tile, title, distance tag, kit Radio) on surface/secondary, the address,
 * a dashed rule, the contact with a verified tick. Selected is as quiet as the reference: the header washes to
 * alice blue, the border to lavender, the icon to the action blue, and the Radio fills (its own 220 ms ease).
 */
export interface AddressOptionProps {
  title: string;
  line: string;
  contact: string;
  distance: string;
  icon: 'home' | 'work' | 'location';
  selected: boolean;
  onSelect: () => void;
}

const ICON = { home: 'home-filled', work: 'briefcase-round-filled', location: 'location-filled' } as const;

export function AddressOption({ title, line, contact, distance, icon, selected, onSelect }: AddressOptionProps) {
  return (
    <Pressable
      asDiv
      className={styles.card}
      data-selected={selected || undefined}
      scale={0.98}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={`${title}, ${line}`}
    >
      <div className={styles.head}>
        <ListRow
          variant="field"
          leading={
            <span className={styles.tile}>
              <OriginIcon name={ICON[icon]} size={20} color="currentColor" />
            </span>
          }
          title={
            <span className={styles.titleLine}>
              <span className={styles.titleText}>{title}</span>
              <span className={styles.distance}>{distance}</span>
            </span>
          }
          trailing={<Radio checked={selected} size={20} />}
        />
      </div>
      <div className={styles.body}>
        <p className={styles.line}>{line}</p>
        <DashedDivider inset={0} />
        <p className={styles.contact}>
          {contact}
          <OriginIcon name="verified-filled" size={16} color="var(--nk-field-text-success)" />
        </p>
      </div>
    </Pressable>
  );
}

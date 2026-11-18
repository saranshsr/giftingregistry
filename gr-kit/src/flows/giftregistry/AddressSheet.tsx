import { useEffect, useRef, useState } from 'react';
import { Button, Divider, ListRow, OriginIcon, SheetBody, TextField } from '../../components';
import { useNav } from '../../kit/Navigator';
import { AddressOption } from './components/sheets/AddressOption';
import { addresses, copy, defaultName } from './data';
import { grStore } from './store';
import { haptics } from './haptics';
import styles from './sheets.module.css';

/**
 * Delivery address picker (reference buildAddressSheet, Figma "Address edit" 1407:1700960) as a kit Origin sheet on
 * surface/secondary, with no title, as the design: search field, a card with "Enable location" and "Add new
 * address" (kit Field ListRows), then the saved addresses (AddressOption: ListRow header + kit Radio).
 *
 * Picking one selects it in place; 260 ms later (reference) the sheet drops and the delivery card swaps its address
 * with a 220 ms fade. A second tap inside that window re-targets the pick instead of being swallowed.
 */
const DISTANCE: Record<string, string> = { home: '1.2 km', work: '24 m', ayush: '3.4 km' };
const SETTLE_MS = 260;
const LOCATION = copy.address.location;

export function AddressSheet() {
  const nav = useNav();
  const { address, name } = grStore.useStore((s) => s);
  const [picked, setPicked] = useState(address);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pick = (key: string) => {
    haptics.lightTap();
    setPicked(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      grStore.patch({ address: key });
      nav.back();
    }, SETTLE_MS);
  };
  const who = name.trim() || defaultName;

  return (
    <SheetBody className={styles.addrBody}>
      <TextField
        labelMode="none"
        placeholder={copy.address.search}
        aria-label={copy.address.search}
        leftSlot={<OriginIcon name="search" size={20} color="var(--nk-field-text-primary)" />}
      />
      <div className={styles.addrTools}>
        <ListRow
          variant="field"
          leading={<OriginIcon name="direction-filled" size={20} color="var(--nk-color-link)" />}
          title={<span className={styles.enableTitle}>{LOCATION.title}</span>}
          subtitle={LOCATION.hint}
          trailing={
            <Button variant="fieldSecondary" fieldSize="H32" onClick={() => nav.toast('Location isn’t in this prototype')}>
              {copy.address.enable}
            </Button>
          }
        />
        <div className={styles.addrRule}>
          <Divider />
        </div>
        <ListRow
          variant="field"
          title={copy.address.add}
          leading={<OriginIcon name="plus" size={20} color="var(--nk-field-text-primary)" />}
          onPress={() => nav.toast('“Add new address” isn’t in this prototype')}
        />
      </div>
      <div className={styles.addrList} role="radiogroup" aria-label="Saved addresses">
        {addresses.map((a) => (
          <AddressOption
            key={a.key}
            title={a.title}
            line={a.line}
            contact={a.contact.replace('{name}', who)}
            distance={DISTANCE[a.key] ?? '24 m'}
            icon={a.icon}
            selected={a.key === picked}
            onSelect={() => pick(a.key)}
          />
        ))}
      </div>
    </SheetBody>
  );
}

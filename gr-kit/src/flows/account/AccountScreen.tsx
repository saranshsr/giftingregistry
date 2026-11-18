import { motion } from 'motion/react';
import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { NeedHelpButton, Pressable, Screen } from '../../components';
import { useNav } from '../../kit/Navigator';
import { currency, formatPrice, user } from '../../data';
import { AccountFooter } from './components/AccountFooter';
import { ActionCards } from './components/ActionCards';
import { AccountSectionItem } from './components/AccountSection';
import { CountryRow, LanguageRow, MenuGroup } from './components/MenuGroup';
import { ProfileCard } from './components/ProfileCard';
import { accountSection, securitySection, settingsSection } from './data';
import { AccountIconImg } from './icons';
import styles from './account.module.css';

const enter = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, mass: 1, damping: 15, stiffness: 120, delay: 0.05 * i },
});

/**
 * Signed-in Account (NoonAccountScreen → NoonAccountSignedInState).
 * Page #F2F3F7, sections 12 apart, edgeSpacing 15.
 */
export function AccountScreen({
  secondCard,
  helpCollapseAfter,
  helpCollapsed,
  ordersThumbs,
}: {
  params?: unknown;
  /** host flows (e.g. giftregistry) can swap the "My Wishlist" action card for their own entry card */
  secondCard?: ReactNode;
  /** fold the "Need help?" pill after this many ms even without a scroll (giftregistry page-load intro: 2600) */
  helpCollapseAfter?: number;
  /** host-controlled fold of the "Need help?" pill (ORed with the scroll / timer rules) */
  helpCollapsed?: boolean;
  /** host flows can show their own photos in the My Orders tiles */
  ordersThumbs?: string[];
} = {}) {
  const nav = useNav();
  // the floating "Need help?" pill folds into its icon once the page scrolls (Accounts Figma 8924:67388)
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback((y: number) => setScrolled(y > 24), []);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (helpCollapseAfter == null) return;
    const t = setTimeout(() => setTimedOut(true), helpCollapseAfter);
    return () => clearTimeout(t);
  }, [helpCollapseAfter]);
  return (
    <Screen
      background="bgPage"
      withTabBar
      safeTop={false}
      onScroll={onScroll}
      overlay={<NeedHelpButton collapsed={scrolled || timedOut || !!helpCollapsed} onPress={() => nav.toast('Opening Customer happiness center')} />}
    >
      <AccountBody secondCard={secondCard} ordersThumbs={ordersThumbs} />
    </Screen>
  );
}

/** The page under the pill; memoised so the scroll flag doesn't re-render (and re-animate) every section. */
const AccountBody = memo(function AccountBody({ secondCard, ordersThumbs }: { secondCard?: ReactNode; ordersThumbs?: string[] }) {
  const nav = useNav();
  return (
    <>
      <div className={styles.statusCover} />
      <div className={styles.page}>
        <motion.div {...enter(0)}>
          <ProfileCard />
        </motion.div>
        <motion.div {...enter(1)}>
          <ActionCards secondCard={secondCard} ordersThumbs={ordersThumbs} />
        </motion.div>
        <motion.div {...enter(2)}>
          <Pressable className={styles.creditsRow} scale={0.98} onClick={() => nav.toast('noon Credits')}>
            <AccountIconImg name="credits" size={20} />
            <span className={styles.creditsLabel}>noon Credits</span>
            <span className={styles.creditsPill}>
              <span>
                {currency} {formatPrice(user.credits)}
              </span>
              <AccountIconImg name="chevron" size={12} />
            </span>
          </Pressable>
        </motion.div>
        <motion.div {...enter(3)}>
          <MenuGroup items={accountSection} extra={[<LanguageRow key="lang" />, <CountryRow key="country" />]} />
        </motion.div>
        <motion.div {...enter(4)}>
          <MenuGroup items={settingsSection} />
        </motion.div>
        <motion.div {...enter(5)}>
          <MenuGroup
            items={securitySection}
            extra={[<AccountSectionItem key="signout" before={<AccountIconImg name="signOut" size={20} />} title="Sign out" onPress={() => nav.sheet('account/signOut')} />]}
          />
        </motion.div>
        <motion.div {...enter(6)}>
          <AccountFooter />
        </motion.div>
      </div>
    </>
  );
});

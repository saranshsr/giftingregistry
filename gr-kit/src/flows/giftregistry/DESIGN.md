# Gift Registry — design record

## Request

- Problem: rebuild the Gift Registry creation prototype (flow-proto, Figma Zs6qEAZ1Uaej4LcKst0sbp · 843:719902) inside the noon UI kit so it reads as part of the real app.
- Audience and entry point: a signed-in shopper, from the Account tab → My Lists.
- Outcome: one clickable flow, Account → My Lists → Create sheet → What is a Gift Registry → Occasion, Whose, Name, When / Due date, Delivery → back on My Lists with the new registry.
- Size: large · Flow: `giftregistry` · Neighbours read: `src/flows/account`, `src/flows/wishlist`, `.claude/skills/account/spec.md`, the reference prototype (flow 6).

## Research

- Repo patterns: the live kit Account (`src/flows/account/AccountScreen.tsx`) and Wishlist (`src/flows/wishlist/WishlistScreen.tsx`) are reused as they are, through optional props; sheets are the Origin `presentation: 'sheet'` with `SheetHeader` / `SheetBody` / `SheetFooter`.
- Mobbin: not needed: the screens, copy and motion are given (Figma + the reference prototype).

## Approaches

One clear approach: reuse the kit screens for Account and My Lists, build the Create sheet, explainer and steps from kit parts, and keep only the Figma pieces the kit lacks (occasion tiles art, hero lotties, number pad, themed page backgrounds, explainer columns).

## Decisions and assumptions

- The kit holds the app's current components; where Figma shows an older one, the kit's wins (user).
- Motion follows the reference's choreography with the kit's MOVE spring (300 / 28), ease-out cubic fades and 60 / 40 ms staggers (user, noon motion standard). The explainer → step morph uses a calmer critically damped spring because it travels the whole screen.
- Picking an occasion recolours 1.1's page and ribbon at once, at the current lottie frame (user).
- Eid, Wedding, House warming, Anniversary and Other derive their page colours from their swoosh (user).
- The occasion tile selection copies the reference's flow 6 CSS 1:1 (user).
- Create lands on the registry page (Figma 843:723290) with a calm `gr-reveal` hand-off, no splash and no toast; Back returns to My Lists where the new card rides in (user).
- Occasion themes are Figma's own (575:158585) (user).
- "Pick from calendar" opens the system date picker (native on iPhone, an iOS stand-in on desktop) (user).
- The View Cart pill is hidden in this flow (user).
- Step buttons follow Figma (nano button, Back button, calendar chip) over the kit defaults (user).
- The date step behaves like the reference's flow 6 date field and number pad, and keeps a picked date in the field until the user taps Continue (user, 17 Nov: no auto-advance).
- My Lists and My Orders show the reference's product photos (`products.ts`); saved items 2–4 have their own names and prices (user).

## Design direction

| Section (top → bottom) | Component                                                                         | Tokens / variant     | Notes                                        |
| ---------------------- | --------------------------------------------------------------------------------- | -------------------- | -------------------------------------------- |
| Account                | kit `AccountScreen` + `GiftRegistriesCard`                                        | acct tokens, `Badge` | teaser states 01–05 on page load             |
| My Lists               | kit `WishlistScreen` + `RegistryStrip`                                            | wishlist tokens      | Create pill opens the Create sheet           |
| Create / explainer     | Origin sheet, `SheetBody`, `Pressable`, `Button` dark, `Lottie`                   | bg-subtle cards, r12 | grows in place, morphs into step 1           |
| Steps                  | `Screen`, `IconButton`, `TextField`, `Pill` fieldChip, `Button`, `Checkbox` field | occasion theme vars  | hero `Lottie`, themed background, number pad |
| Calendar / Address     | Origin sheets, `SheetFooter` split, `Radio`, `ListRow` field, `TextField`         | —                    | write into the flow store                    |

New pieces (gap → closest existing → extension; flow-local or shared): `OccasionTile`, `HeroLottie`, `ThemedBackground`, `GiftRegistriesCard`, `RegistryStrip` (flow-local; no kit equivalent). Kit extensions: `Lottie onPlayer`, Origin sheet `dragScrim` / `dismissRatio` / `dissolveOnReplace`, Account `secondCard` / `helpCollapseAfter`, Wishlist `title` / `onCreate` / `lead` / `collections`.

## States

| State    | How it's shown                                                                  | How the user leaves it |
| -------- | ------------------------------------------------------------------------------- | ---------------------- |
| loading  | heroes hold until their file has loaded; the rest is local                      | —                      |
| empty    | empty answers: grey CTA; tapping it shakes it with a toast, the field turns red | type / pick            |
| error    | invalid date: digits turn red, toast "Enter a valid date"                       | fix the date           |
| success  | "“<name>” created" toast, the new card rides into My Lists                      | —                      |
| disabled | past days in the calendar                                                       | pick a later day       |

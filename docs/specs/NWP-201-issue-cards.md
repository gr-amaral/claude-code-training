# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Gabriel Amaral
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens 12–20 times a week, and last month two cards went out with the wrong limit. Marcus wants issue, list, and detail in the console today.

## Current state

Paths are under `build-battle/merchant-console/`.

- `src/data/store.ts` — in-memory store on `globalThis`; no `cards` slice. Restart `next dev` after adding one.
- `src/data/generate.ts` — seed is generated TypeScript, not JSON as `CLAUDE.md` says; `pad()` builds ids. Card fixtures go here.
- `src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"` already is the allowlist. No `Card` type.
- `src/data/merchants.ts` — `merchantById()` returns `undefined` when unknown; each merchant has a `currency` nothing checks yet.
- `src/lib/money.ts` — `parseAmountToMinorUnits` (boundary converter), `formatMoney`. `src/lib/dates.ts` — `formatInZone`.
- `src/app/api/payments/export/route.ts` — the route pattern: `as const` allowlist, `{ value } | { error }` validator, `NextResponse.json({ error }, { status: 400 })`. No POST handler exists anywhere.
- `src/app/payments/page.tsx`, `[id]/page.tsx` — server components reading the store; inline empty state; `Field` grid and timeline. Next 15 `params` are promises.
- `src/app/payments/export-dialog.tsx` — form dialog on `src/components/Drawer.tsx`; there is no `Dialog.tsx` despite `.claude/rules/components.md`.
- `src/components/ui/payments/StatusBadge.tsx` — three `Record<AnyStatus, …>` maps to extend.
- `src/data/queries.ts:81` — defect: amounts sorted with `String().localeCompare`. One-line fix in passing.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `CLAUDE.md`, ticket rule 1 | The wrong-limit bug ops is escaping |
| "Never persist or display a full card number after creation." | ticket rule 2, `.claude/rules/cards.md` | A PAN in the store or a payload |
| "`active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard on the server." | ticket rule 3, `cards.md` | A cancelled card comes back |
| "Every generated number starts `4242` with a valid Luhn check digit. Generate on the server." | ticket rule 4, `cards.md` | Something resembling a real PAN |
| Reject missing merchant, limit ≤ 0, limit > 5,000,000, currency ∉ USD/EUR/GBP, on the server | ticket core 6, `api-routes.md` | Client-only enforcement |
| Labelled inputs, named dialog, focus handled, Escape closes; written empty and error states | `components.md` | Unusable by keyboard; blank tables |

## Approach

Add a `cards` slice to the store, a pure `src/lib/cards.ts` (Luhn generator on the 4242 BIN, transition table, `parseCardInput` converting the limit string once via `parseAmountToMinorUnits`), `POST /api/cards` (the only response carrying a full number) and `PATCH /api/cards/[id]` (guarded transitions). `/cards` and `/cards/[id]` are server components like `/payments`; the issue form is a client dialog cloned from `export-dialog.tsx` that shows the number once and wipes it on close. Beyond the ticket: currency must match the merchant, a client `requestId` makes issue idempotent, every transition is recorded on the card, and cancel needs a confirm.

**Considered and rejected:** generating the number in the browser (`cards.md` calls it a bug); a module-level cards array (resets on HMR, unlike the `globalThis` store).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory`, `CardEvent` |
| `src/data/generate.ts` | change | export `pad`, two fixture cards |
| `src/data/store.ts` | change | `cards` slice |
| `src/data/cards.ts` | add | `listCards`, `cardById`, `createCard`, `transitionCard` |
| `src/lib/cards.ts`, `src/lib/cards.test.ts` | add | Luhn, generator, mask, transitions, `parseCardInput`, spend percent, tests |
| `src/app/api/cards/route.ts`, `src/app/api/cards/[id]/route.ts` | add | GET/POST issue, PATCH status |
| `src/app/cards/page.tsx`, `[id]/page.tsx`, `issue-card-dialog.tsx`, `card-actions.tsx`, `spend-bar.tsx` | add | list, detail, form, freeze/unfreeze/cancel, progress bar |
| `StatusBadge.tsx`, `siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | change | card statuses, navigation |
| `src/data/queries.ts` | change | numeric amount sort |

## Plan

1. **Types, store, lib, tests** — done when `npm test` is green with `cards.test.ts`.
2. **Routes** — done when curl shows 201 with a `4242…` Luhn-valid number, 400 per rejection, 409 for `cancelled → active`, no 16-digit string in `GET /api/cards`.
3. **Nav, list, dialog, detail** — done when a card issued in the browser appears masked in the list and opens in detail.
4. **Stretch** — done when freeze/unfreeze changes the badge without navigation, the 90% fixture shows amber, cancel confirms then offers no actions.
5. **Ship** — lint, test, `/ship-ready`, PR.

## Out of scope

Persistence (NWP-203), auth, real issuer calls, editing a limit (NWP-202). `spent` is 0 at issue and stays 0; fixtures carry spend only so bar states are visible.

# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Gabriel Amaral
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants ops to issue a card, see the cards they issued, and open one to check it — from the console, today.

## Current state

- `build-battle/merchant-console/src/data/store.ts` — the in-memory store, pinned on `globalThis` so dev HMR does not reset it. Holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. **No `cards` slice.** Adding one means editing both the `Store` interface and `createStore()`, and restarting `next dev` once because the cached object predates the change.
- `build-battle/merchant-console/src/data/generate.ts` — seed data is **generated TypeScript**, not JSON as `merchant-console/CLAUDE.md` says. IDs use a local `pad()` helper (`pay_000001`). Card seeds belong here, next to the other fixtures.
- `build-battle/merchant-console/src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"` already exists and is exactly the ticket's allowlist. No `Card` type.
- `build-battle/merchant-console/src/data/merchants.ts` — `merchantById(id)` returns `undefined` for an unknown merchant; every merchant carries a `currency`. Nothing in the console checks a card's currency against it yet.
- `build-battle/merchant-console/src/lib/money.ts` — `parseAmountToMinorUnits("250.00") → 25000 | null` is the boundary converter; `formatMoney(minor, currency)` is the only formatter.
- `build-battle/merchant-console/src/lib/dates.ts` — `formatInZone(iso, tz)` for display in the merchant's timezone.
- `build-battle/merchant-console/src/app/api/payments/export/route.ts` — the house route pattern: `as const` allowlist, validator returning `{ value } | { error }`, `NextResponse.json({ error }, { status: 400 })`, reject early. There is **no POST handler anywhere** yet.
- `build-battle/merchant-console/src/app/payments/page.tsx` and `src/app/payments/[id]/page.tsx` — server components that read the store directly; list uses an inline `colSpan` empty state, detail uses a `Field` grid and a timeline `<ol>`. Next 15: `params`/`searchParams` are promises.
- `build-battle/merchant-console/src/app/payments/export-dialog.tsx` — the form-dialog pattern built on `src/components/Drawer.tsx` (Radix dialog) with a centered-modal className. There is no `Dialog.tsx`, despite `.claude/rules/components.md` saying so.
- `build-battle/merchant-console/src/components/ui/payments/StatusBadge.tsx` — three `Record<AnyStatus, …>` maps; card statuses must be added to all three.
- `build-battle/merchant-console/src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx`, `Breadcrumbs.tsx` — where a `/cards` link and label are registered.
- `build-battle/merchant-console/src/data/queries.ts:81` — pre-existing defect: amounts are sorted with `String(...).localeCompare`, so 9900 sorts above 100000. Fixed in passing because it is one line and the cards list sorts money too.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md`, ticket rule 1 | Cents drift; the exact wrong-limit bug ops is escaping |
| "Never persist or display a full card number after creation. Store the last four and the generated number's reference." | ticket rule 2, `.claude/rules/cards.md` | A PAN in the store or a list payload |
| "`active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server." | ticket rule 3, `.claude/rules/cards.md` | A cancelled card comes back to life |
| "Every generated number starts `4242` and carries a valid Luhn check digit. Generate on the server." | ticket rule 4, `.claude/rules/cards.md` | Something resembling a real PAN |
| "Validate everything from the client against an allowlist." Reject missing merchant, limit ≤ 0, limit > 5,000,000, currency ∉ USD/EUR/GBP | `.claude/rules/api-routes.md`, ticket core 6 | Client-only checks are enforcement nowhere |
| "Dialogs and forms must be operable. Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Keyboard and screen-reader users cannot issue a card |
| "Write the empty and error states." | `.claude/rules/components.md` | A blank table, a silent failed request |

## Approach

Add a `cards` slice to the existing store, a pure `src/lib/cards.ts` (Luhn generator on the `4242` BIN, transition table, input parser that converts the limit string once via `parseAmountToMinorUnits`), and two route handlers: `POST /api/cards` (the only response that ever carries a full number) and `PATCH /api/cards/[id]` (status transitions guarded by the table). Pages `/cards` and `/cards/[id]` are server components reading the store like `/payments`; the issue form is a client dialog cloned from `export-dialog.tsx` that shows the number once and wipes it on close. Beyond the ticket, the server also rejects a currency that differs from the merchant's, honours a client `requestId` so a double submit cannot mint two cards, records every status change on the card and shows it on the detail page, and cancel requires a confirm step.

**Considered and rejected:** generating the card number in the dialog and posting it — rejected because `cards.md` says a browser-generated number is a bug and it would make masking unverifiable. Also rejected: a separate `cards` module-level array — the store lives on `globalThis` on purpose; a second array would reset on HMR.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory`, `CardEvent` |
| `src/data/generate.ts` | change | export `pad`, seed three cards (one at 90% spend for the amber bar, one frozen) |
| `src/data/store.ts` | change | `cards` slice |
| `src/data/cards.ts` | add | `listCards`, `cardById`, `createCard` (returns the number once), `transitionCard` |
| `src/lib/cards.ts` | add | Luhn, generator, mask, transition table, `parseCardInput`, spend percent |
| `src/lib/cards.test.ts` | add | tests for all of the above |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` issue |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` status |
| `src/app/cards/page.tsx` | add | list with empty state |
| `src/app/cards/[id]/page.tsx` | add | detail, spend bar, audit timeline |
| `src/app/cards/issue-card-dialog.tsx` | add | form, reveal-once success screen |
| `src/app/cards/card-actions.tsx` | add | freeze / unfreeze / cancel (confirm) without reload |
| `src/app/cards/spend-bar.tsx` | add | progress bar, amber past 80% |
| `src/components/ui/payments/StatusBadge.tsx` | change | card statuses |
| `src/app/siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | change | navigation |
| `src/data/queries.ts` | change | numeric amount sort (bug fix) |

## Plan

1. **Types, seed, store, lib, tests** — done when: `npm test` is green with the new `cards.test.ts`.
2. **Routes** — done when: curl shows 201 with a `4242…` Luhn-valid number, 400 for each rejection, 409 for `cancelled → active`, and `GET /api/cards` carries no 16-digit string.
3. **Nav + list + dialog + detail** — done when: a card issued in the browser appears masked in the list and opens in detail.
4. **Stretch** — done when: freeze/unfreeze changes the badge without navigation, the 90% seed shows an amber bar, cancel asks to confirm and then offers no further actions.
5. **Ship** — done when: `npm run lint`, `npm test`, `/ship-ready` pass and the PR is open.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: fill dialog, submit, card in list |
| Card list | `/cards` columns: nickname, merchant, `•••• 4242`, limit, status, created |
| Card detail | `/cards/<id>` shows record, spend bar, audit trail |
| Generated numbers | `cards.test.ts`: starts `4242`, 16 digits, Luhn valid, not constant |
| Reveal once | POST response has `number`; `GET /api/cards` and the `Card` type do not; dialog clears state on close |
| Server-side validation | `cards.test.ts` on `parseCardInput` + curl against the route |
| State machine | `cards.test.ts` full transition matrix; PATCH 409 on cancelled |

## Risks

- `store` is cached on `globalThis`; the dev server must restart once after `store.ts` changes or `store.cards` is `undefined`.
- `src/lib/cards.ts` is imported by client components; it must not import `node:crypto`. Use `globalThis.crypto.getRandomValues`.
- `react/no-unescaped-entities` fails lint on apostrophes in JSX text.

## Out of scope

- Persistence (NWP-203), auth, real issuer calls, editing a limit after issue (NWP-202), pagination on `/cards`.
- `spent` is not simulated: it is `0` at issue and stays `0`. Seed cards carry fixture spend so the bar states are visible.

## Open questions

- Whether ops wants a merchant category list beyond the six placeholders used here.

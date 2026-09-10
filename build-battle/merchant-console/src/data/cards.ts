import { CardInput, canTransition, generateCardNumber } from "@/lib/cards"
import { pad } from "./generate"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * Card reads and writes against the in-memory store. This is the only module
 * that ever sees a full card number, and it returns it once, from createCard,
 * without keeping it.
 */

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Issues a card. A repeated request id returns the card it already created,
 * so a double submit or a retry after a timeout cannot mint two cards; the
 * number is not returned a second time.
 */
export function createCard(
  input: CardInput,
): { card: Card; number: string | null; created: boolean } {
  if (input.requestId) {
    const existing = store.cards.find((c) => c.requestId === input.requestId)
    if (existing) return { card: existing, number: null, created: false }
  }

  const number = generateCardNumber()
  // Cards are never deleted, so the store length is a monotonic sequence and
  // survives dev-server module reloads, unlike a module-level counter.
  const seq = store.cards.length + 1
  const now = new Date().toISOString()
  const card: Card = {
    id: `card_${pad(seq)}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    category: input.category,
    limit: input.limit,
    spent: 0,
    currency: input.currency,
    last4: number.slice(-4),
    numberRef: `cardref_${pad(seq)}`,
    status: "active",
    requestId: input.requestId,
    createdAt: now,
    events: [{ type: "issued", at: now }],
  }
  store.cards.push(card)
  return { card, number, created: true }
}

const EVENT_FOR: Record<Exclude<CardStatus, "active">, "frozen" | "cancelled"> =
  { frozen: "frozen", cancelled: "cancelled" }

/** Moves a card through the state machine, or explains why it cannot. */
export function transitionCard(
  id: string,
  to: CardStatus,
): { card: Card } | { error: string; status: 404 | 409 } {
  const card = cardById(id)
  if (!card) return { error: "Card not found.", status: 404 }
  if (card.status === "cancelled") {
    return { error: "A cancelled card cannot be changed.", status: 409 }
  }
  if (!canTransition(card.status, to)) {
    return { error: `Card is already ${card.status}.`, status: 409 }
  }

  card.status = to
  card.events.push({
    type: to === "active" ? "unfrozen" : EVENT_FOR[to],
    at: new Date().toISOString(),
  })
  return { card }
}

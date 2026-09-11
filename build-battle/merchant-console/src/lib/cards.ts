import { merchantById } from "@/data/merchants"
import { CardCategory, CardStatus, Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "./money"

/**
 * Pure card rules. No store access and no Node-only imports, because client
 * components read the transition table from here.
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

export const CARD_STATUSES = ["active", "frozen", "cancelled"] as const
export const CARD_CATEGORIES = [
  "any",
  "advertising",
  "software",
  "contractors",
  "travel",
  "office",
] as const
export const CURRENCIES = ["USD", "EUR", "GBP"] as const

/** Ticket NWP-201: the largest limit a card may carry, in minor units. */
export const MAX_LIMIT_MINOR = 5_000_000
export const MAX_NICKNAME_LENGTH = 40

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  any: "Any category",
  advertising: "Advertising",
  software: "Software",
  contractors: "Contractors",
  travel: "Travel",
  office: "Office supplies",
}

/** Luhn check digit for a partial number (every digit except the last). */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  // Walk right to left; doubling starts on the rightmost digit of the partial
  // because the check digit will occupy the final position.
  for (
    let i = partial.length - 1, double = true;
    i >= 0;
    i--, double = !double
  ) {
    let digit = Number(partial[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

export function isLuhnValid(number: string): boolean {
  if (!/^\d{2,}$/.test(number)) return false
  const partial = number.slice(0, -1)
  return luhnCheckDigit(partial) === Number(number[number.length - 1])
}

/** 16 digits on the 4242 test BIN with a valid check digit (CSPRNG body). */
export function generateCardNumber(): string {
  const bodyLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  const random = globalThis.crypto.getRandomValues(new Uint32Array(bodyLength))
  const partial = TEST_BIN + Array.from(random, (n) => n % 10).join("")
  return partial + luhnCheckDigit(partial)
}

export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/** The state machine. `cancelled` has no exits. */
export const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export interface CardInput {
  nickname: string
  merchantId: string
  category: CardCategory
  /** Integer minor units, converted once from the client's string. */
  limit: number
  currency: Currency
  requestId: string | null
}

type ParseResult = { input: CardInput } | { error: string }

/**
 * Validates POST /api/cards. Every field is allowlisted; the limit arrives as
 * a string and is converted to minor units exactly once, here.
 */
export function parseCardInput(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." }
  }
  const raw = body as Record<string, unknown>

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (nickname.length === 0) {
    return { error: "Give the card a nickname." }
  }
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return {
      error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.`,
    }
  }

  if (typeof raw.merchantId !== "string" || raw.merchantId.length === 0) {
    return { error: "Choose a merchant." }
  }
  const merchant = merchantById(raw.merchantId)
  if (!merchant) {
    return { error: "Unknown merchant." }
  }

  if (!CURRENCIES.includes(raw.currency as Currency)) {
    return { error: "Currency must be USD, EUR, or GBP." }
  }
  const currency = raw.currency as Currency
  if (currency !== merchant.currency) {
    return {
      error: `${merchant.name} settles in ${merchant.currency}; the card must use the same currency.`,
    }
  }

  if (typeof raw.limit !== "string") {
    return { error: "Enter a spend limit like 250.00." }
  }
  const limit = parseAmountToMinorUnits(raw.limit)
  if (limit === null) {
    return { error: "Enter a spend limit like 250.00." }
  }
  if (limit <= 0) {
    return { error: "Spend limit must be greater than zero." }
  }
  if (limit > MAX_LIMIT_MINOR) {
    return { error: "Spend limit cannot exceed 5,000,000 minor units." }
  }

  const category = raw.category === undefined ? "any" : raw.category
  if (!CARD_CATEGORIES.includes(category as CardCategory)) {
    return { error: "Unknown merchant category." }
  }

  const requestId =
    typeof raw.requestId === "string" && raw.requestId.length > 0
      ? raw.requestId
      : null

  return {
    input: {
      nickname,
      merchantId: merchant.id,
      category: category as CardCategory,
      limit,
      currency,
      requestId,
    },
  }
}

/** Bar ratio, clamped to 100. Both inputs are minor units of one currency. */
export function spendPercent(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.floor((spent * 100) / limit))
}

/** Bar colour band. The ticket says amber past 80%. */
export function spendLevel(percent: number): "ok" | "warn" | "over" {
  if (percent >= 100) return "over"
  if (percent > 80) return "warn"
  return "ok"
}

import { describe, expect, it } from "vitest"
import {
  MAX_LIMIT_MINOR,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCard,
  parseCardInput,
  spendLevel,
  spendPercent,
} from "./cards"

/**
 * Numbers live on the 4242 test BIN with a real check digit, cancelled is
 * terminal, and the server rejects what the ticket says it must.
 */

describe("luhnCheckDigit", () => {
  it("completes the canonical test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("matches the classic Luhn vector", () => {
    expect(luhnCheckDigit("7992739871")).toBe(3)
  })
})

describe("isLuhnValid", () => {
  it("accepts a valid number and rejects a one-digit change", () => {
    expect(isLuhnValid("4242424242424242")).toBe(true)
    expect(isLuhnValid("4242424242424241")).toBe(false)
  })

  it("rejects non-digits and empty input", () => {
    expect(isLuhnValid("4242 4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits on the 4242 test BIN with a valid check digit, every time", () => {
    for (let i = 0; i < 100; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isLuhnValid(number)).toBe(true)
    }
  })

  it("is not a constant", () => {
    const numbers = new Set(Array.from({ length: 50 }, generateCardNumber))
    expect(numbers.size).toBeGreaterThan(1)
  })
})

describe("maskCard", () => {
  it("shows only the last four", () => {
    expect(maskCard("4242")).toBe("•••• 4242")
  })
})

describe("canTransition", () => {
  it.each([
    ["active", "frozen", true],
    ["frozen", "active", true],
    ["active", "cancelled", true],
    ["frozen", "cancelled", true],
    ["cancelled", "active", false],
    ["cancelled", "frozen", false],
    ["active", "active", false],
    ["frozen", "frozen", false],
    ["cancelled", "cancelled", false],
  ] as const)("%s → %s is %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed)
  })
})

describe("parseCardInput", () => {
  const valid = {
    nickname: " Google Ads ",
    merchantId: "mch_01",
    limit: "250.00",
    currency: "USD",
  }

  it("converts the limit to minor units once and trims the nickname", () => {
    const result = parseCardInput(valid)
    expect(result).toEqual({
      input: {
        nickname: "Google Ads",
        merchantId: "mch_01",
        category: "any",
        limit: 25000,
        currency: "USD",
        requestId: null,
      },
    })
  })

  it("treats 250 and 250.00 as the same limit", () => {
    const a = parseCardInput({ ...valid, limit: "250" })
    const b = parseCardInput({ ...valid, limit: "250.00" })
    expect(a).toEqual(b)
  })

  it.each([
    ["missing merchant", { merchantId: "" }, "Choose a merchant."],
    ["unknown merchant", { merchantId: "mch_99" }, "Unknown merchant."],
    ["zero limit", { limit: "0" }, "Spend limit must be greater than zero."],
    ["negative limit", { limit: "-5" }, "Enter a spend limit like 250.00."],
    ["non-decimal limit", { limit: "abc" }, "Enter a spend limit like 250.00."],
    // A number would be ambiguous between cents and dollars; only strings.
    ["numeric limit", { limit: 25000 }, "Enter a spend limit like 250.00."],
    [
      "one cent over the ceiling",
      { limit: "50000.01" },
      "Spend limit cannot exceed 5,000,000 minor units.",
    ],
    [
      "currency outside the allowlist",
      { currency: "JPY" },
      "Currency must be USD, EUR, or GBP.",
    ],
    [
      "lowercase currency",
      { currency: "usd" },
      "Currency must be USD, EUR, or GBP.",
    ],
    // mch_04 settles in GBP.
    [
      "currency differing from the merchant",
      { merchantId: "mch_04" },
      "Halcyon Studio settles in GBP; the card must use the same currency.",
    ],
    ["blank nickname", { nickname: "   " }, "Give the card a nickname."],
    [
      "overlong nickname",
      { nickname: "x".repeat(41) },
      "Nickname must be 40 characters or fewer.",
    ],
    [
      "unknown category",
      { category: "gambling" },
      "Unknown merchant category.",
    ],
  ])("rejects a %s", (_, patch, error) => {
    expect(parseCardInput({ ...valid, ...patch })).toEqual({ error })
  })

  it("accepts exactly 5,000,000 minor units and a matching merchant currency", () => {
    expect(parseCardInput({ ...valid, limit: "50000" })).toHaveProperty(
      "input.limit",
      MAX_LIMIT_MINOR,
    )
    expect(
      parseCardInput({
        ...valid,
        merchantId: "mch_04",
        currency: "GBP",
        category: "software",
      }),
    ).toMatchObject({ input: { currency: "GBP", category: "software" } })
  })

  it("never throws on a non-object body", () => {
    expect(parseCardInput(null)).toHaveProperty("error")
    expect(parseCardInput("x")).toHaveProperty("error")
    expect(parseCardInput([])).toHaveProperty("error")
  })
})

describe("spendPercent and spendLevel", () => {
  it("computes a clamped whole-number ratio", () => {
    expect(spendPercent(0, 10000)).toBe(0)
    expect(spendPercent(8000, 10000)).toBe(80)
    expect(spendPercent(12000, 10000)).toBe(100)
    expect(spendPercent(0, 0)).toBe(0)
  })

  it("turns amber past 80%, not at it", () => {
    expect(spendLevel(80)).toBe("ok")
    expect(spendLevel(81)).toBe("warn")
    expect(spendLevel(100)).toBe("over")
  })
})

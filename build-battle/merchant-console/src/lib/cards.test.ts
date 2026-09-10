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
 * The rules that make a card shippable rather than merely visible: numbers
 * live on the 4242 test BIN with a real check digit, cancelled is terminal,
 * and the server rejects what the ticket says it must reject with the limit
 * held in integer minor units.
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

  it("rejects a missing or unknown merchant", () => {
    expect(parseCardInput({ ...valid, merchantId: "" })).toEqual({
      error: "Choose a merchant.",
    })
    expect(parseCardInput({ ...valid, merchantId: "mch_99" })).toEqual({
      error: "Unknown merchant.",
    })
  })

  it("rejects a zero or negative limit", () => {
    expect(parseCardInput({ ...valid, limit: "0" })).toEqual({
      error: "Spend limit must be greater than zero.",
    })
    expect(parseCardInput({ ...valid, limit: "-5" })).toHaveProperty("error")
  })

  it("accepts exactly 5,000,000 minor units and rejects one cent more", () => {
    // 50,000.00 is the ceiling; 50,000.01 is 5,000,001 minor units.
    const atMax = parseCardInput({ ...valid, limit: "50000" })
    expect(atMax).toHaveProperty("input.limit", MAX_LIMIT_MINOR)
    expect(parseCardInput({ ...valid, limit: "50000.01" })).toEqual({
      error: "Spend limit cannot exceed 5,000,000 minor units.",
    })
  })

  it("rejects a limit that is not a decimal string", () => {
    expect(parseCardInput({ ...valid, limit: "abc" })).toHaveProperty("error")
    // A number would be ambiguous between cents and dollars; only strings.
    expect(parseCardInput({ ...valid, limit: 25000 })).toHaveProperty("error")
  })

  it("rejects currencies outside USD, EUR, GBP, case-sensitively", () => {
    expect(parseCardInput({ ...valid, currency: "JPY" })).toEqual({
      error: "Currency must be USD, EUR, or GBP.",
    })
    expect(parseCardInput({ ...valid, currency: "usd" })).toHaveProperty(
      "error",
    )
  })

  it("rejects a currency that differs from the merchant's", () => {
    // mch_04 settles in GBP.
    const result = parseCardInput({ ...valid, merchantId: "mch_04" })
    expect(result).toHaveProperty("error")
    expect(
      parseCardInput({ ...valid, merchantId: "mch_04", currency: "GBP" }),
    ).toHaveProperty("input.currency", "GBP")
  })

  it("rejects a missing, blank, or overlong nickname", () => {
    expect(parseCardInput({ ...valid, nickname: undefined })).toHaveProperty(
      "error",
    )
    expect(parseCardInput({ ...valid, nickname: "   " })).toHaveProperty(
      "error",
    )
    expect(
      parseCardInput({ ...valid, nickname: "x".repeat(41) }),
    ).toHaveProperty("error")
  })

  it("allowlists the category", () => {
    expect(parseCardInput({ ...valid, category: "gambling" })).toEqual({
      error: "Unknown merchant category.",
    })
    expect(parseCardInput({ ...valid, category: "software" })).toHaveProperty(
      "input.category",
      "software",
    )
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

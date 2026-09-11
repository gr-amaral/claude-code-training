import { Currency } from "@/data/types"
import { spendLevel, spendPercent } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

// Tailwind only sees literal class names, so the width is bucketed to 10%.
const WIDTHS = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-1/2",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
] as const

const FILL = {
  ok: "bg-blue-500 dark:bg-blue-500",
  warn: "bg-amber-500 dark:bg-amber-400",
  over: "bg-red-500 dark:bg-red-500",
} as const

/** Spend against the limit. Amber past 80%, red once the limit is reached. */
export function SpendBar({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const percent = spendPercent(spent, limit)
  const level = spendLevel(percent)

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)} spent
        </span>
        <span className="tabular-nums text-gray-500">
          {percent}% of {formatMoney(limit, currency)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Spend against limit"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            FILL[level],
            WIDTHS[Math.round(percent / 10)],
          )}
        />
      </div>
      {level === "warn" && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          Past 80% of the limit.
        </p>
      )}
      {level === "over" && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-500">
          Limit reached. New charges will decline.
        </p>
      )}
    </div>
  )
}

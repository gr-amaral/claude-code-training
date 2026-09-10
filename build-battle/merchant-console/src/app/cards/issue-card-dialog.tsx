"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import type { Card, CardCategory, Currency } from "@/data/types"
import { CATEGORY_LABELS } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

type MerchantOption = { id: string; name: string; currency: Currency }

type Issued = { card: Card; number: string | null }

/**
 * Issue a virtual card. The form posts to /api/cards, which validates every
 * field again; this component only shapes the request. The full number is
 * shown once on the success screen and dropped from state when the dialog
 * closes.
 */
export function IssueCardDialog({
  merchants,
  categories,
}: {
  merchants: MerchantOption[]
  categories: readonly CardCategory[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [category, setCategory] = useState<CardCategory>("any")
  const [limit, setLimit] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  // One id per attempt; the server returns the same card if it sees it twice.
  const requestId = useRef<string | null>(null)
  const successHeading = useRef<HTMLHeadingElement>(null)

  const merchant = merchants.find((m) => m.id === merchantId)
  // Currency is the merchant's; the server verifies this too.
  const currency = merchant?.currency

  useEffect(() => {
    if (issued) successHeading.current?.focus()
  }, [issued])

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setCategory("any")
    setLimit("")
    setError(null)
    setIssued(null)
    setSubmitting(false)
    requestId.current = null
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    // Closing wipes the revealed number; there is no way to see it again.
    if (!next) reset()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    requestId.current ??= globalThis.crypto.randomUUID()

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          category,
          limit,
          currency,
          requestId: requestId.current,
        }),
      })
      const body = (await response.json().catch(() => null)) as
        (Issued & { error?: undefined }) | { error: string } | null
      if (!response.ok || !body || "error" in body) {
        setError(body?.error ?? "The card could not be issued. Try again.")
        return
      }
      setIssued(body)
      router.refresh()
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      {/* Centered modal rather than the Drawer's default side panel. */}
      <DrawerContent className="inset-0 m-auto h-fit max-h-[90vh] data-[state=closed]:animate-hide data-[state=open]:animate-slideUpAndFade sm:inset-0 sm:max-w-md">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>
                <span
                  ref={successHeading}
                  tabIndex={-1}
                  className="outline-none"
                >
                  Card issued
                </span>
              </DrawerTitle>
              <DrawerDescription className="text-sm">
                {issued.number
                  ? "Copy the number now. It is shown once and cannot be recovered."
                  : "This card was already issued; the number was shown at the time."}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="mt-0.5 text-gray-900 dark:text-gray-50">
                    {issued.card.nickname}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Card number</dt>
                  <dd className="mt-0.5 font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                    {issued.number
                      ? issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")
                      : `•••• ${issued.card.last4}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Spend limit</dt>
                  <dd className="mt-0.5 tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.limit, issued.card.currency)}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription className="text-sm">
                Single-merchant, virtual, with a limit from the start.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="e.g. Google Ads"
                  maxLength={40}
                  autoComplete="off"
                  className="mt-1.5"
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="card-merchant" className="mt-1.5">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant category lock
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger id="card-category" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    name="limit"
                    type="text"
                    inputMode="decimal"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="250.00"
                    autoComplete="off"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    Currency
                  </span>
                  <p
                    className="mt-1.5 rounded-md border border-gray-300 bg-gray-50 px-2.5 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                    aria-live="polite"
                  >
                    {currency ?? "—"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                {merchant
                  ? `${merchant.name} settles in ${merchant.currency}, so the card does too.`
                  : "The currency follows the merchant."}
              </p>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-500"
                >
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter className="gap-2 sm:gap-0">
              <DrawerClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                isLoading={submitting}
                loadingText="Issuing"
              >
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}

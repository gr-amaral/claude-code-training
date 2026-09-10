"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { canTransition } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze, unfreeze, and cancel a card in place. Each action goes through the
 * guarded PATCH route and then refreshes the server-rendered page data
 * without a full reload. Cancel asks for confirmation first, because it is
 * terminal.
 */
export function CardActions({
  cardId,
  status,
  nickname,
}: {
  cardId: string
  status: CardStatus
  nickname: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">No actions</span>
  }

  const transition = async (to: CardStatus) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        setError(body?.error ?? "The card could not be updated. Try again.")
        return
      }
      setConfirmingCancel(false)
      startTransition(() => router.refresh())
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  const working = busy || pending

  if (confirmingCancel) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Cancel {nickname}? This cannot be undone.
        </span>
        <Button
          variant="destructive"
          className="py-1"
          isLoading={working}
          loadingText="Cancelling"
          onClick={() => transition("cancelled")}
        >
          Confirm cancel
        </Button>
        <Button
          variant="secondary"
          className="py-1"
          disabled={working}
          onClick={() => {
            setConfirmingCancel(false)
            setError(null)
          }}
        >
          Keep card
        </Button>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-500">
            {error}
          </p>
        )}
      </div>
    )
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canTransition(status, next) && (
        <Button
          variant="secondary"
          className="py-1"
          isLoading={working}
          loadingText={next === "frozen" ? "Freezing" : "Unfreezing"}
          onClick={() => transition(next)}
        >
          {next === "frozen" ? "Freeze" : "Unfreeze"}
        </Button>
      )}
      <Button
        variant="ghost"
        className="py-1 text-red-600 dark:text-red-500"
        disabled={working}
        onClick={() => setConfirmingCancel(true)}
      >
        Cancel card
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}

import { transitionCard } from "@/data/cards"
import { CARD_STATUSES } from "@/lib/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

/**
 * Moves a card through the status state machine: active ⇄ frozen, either to
 * cancelled, and cancelled is terminal. The transition is guarded here, not
 * only in the UI.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    )
  }

  const status = (body as { status?: unknown } | null)?.status
  if (!CARD_STATUSES.includes(status as CardStatus)) {
    return NextResponse.json(
      { error: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = transitionCard(id, status as CardStatus)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ card: result.card })
}

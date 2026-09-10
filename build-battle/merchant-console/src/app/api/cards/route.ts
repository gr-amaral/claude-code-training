import { createCard, listCards } from "@/data/cards"
import { parseCardInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** Every issued card, masked. Card records never carry a full number. */
export function GET() {
  return NextResponse.json({ rows: listCards() })
}

/**
 * Issues a virtual card (NWP-201). The body is validated against allowlists
 * before it reaches the store, and the full number is returned here and
 * nowhere else. A repeated requestId returns the existing card without the
 * number, so a double submit cannot mint two cards.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
  }

  const parsed = parseCardInput(body)
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { card, number, created } = createCard(parsed.input)
  return NextResponse.json({ card, number }, { status: created ? 201 : 200 })
}

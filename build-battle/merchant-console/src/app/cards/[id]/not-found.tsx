import Link from "next/link"

export default function CardNotFound() {
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        Card not found
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        This card does not exist, or it was issued in a previous session and the
        store has since restarted.
      </p>
      <Link
        href="/cards"
        className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        ← All cards
      </Link>
    </div>
  )
}

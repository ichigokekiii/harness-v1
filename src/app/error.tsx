"use client";

export default function ErrorScreen({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-secondary">The page could not finish loading.</p>
        <button className="mt-4 min-h-11 rounded-control bg-primary px-4 text-sm text-primary-ink" onClick={reset} type="button">
          Try again
        </button>
      </div>
    </div>
  );
}

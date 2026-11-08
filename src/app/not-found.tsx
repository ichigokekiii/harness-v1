import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <Link className="mt-4 inline-flex min-h-11 items-center text-sm text-primary" href="/">
          Back home
        </Link>
      </div>
    </div>
  );
}

import { Mark } from "@/components/mark";

export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <Mark />
      <span className="sr-only">Loading Tabi</span>
    </div>
  );
}

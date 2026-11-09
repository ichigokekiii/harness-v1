import { Mark } from "@/components/mark";

export default function Home() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <Mark />
      <span className="sr-only">Opening Tabi</span>
    </div>
  );
}

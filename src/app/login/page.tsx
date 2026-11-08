import { Suspense } from "react";
import { LoginScreen } from "@/components/login-screen";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading sign in</p>}>
      <LoginScreen />
    </Suspense>
  );
}

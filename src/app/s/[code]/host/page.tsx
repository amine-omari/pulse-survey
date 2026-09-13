import { Suspense } from "react";
import HostView from "./HostView";

export default function HostPage() {
  return (
    <Suspense fallback={<p className="text-muted pt-10 text-center">Loading…</p>}>
      <HostView />
    </Suspense>
  );
}

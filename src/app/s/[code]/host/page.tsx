import { Suspense } from "react";
import HostView from "./HostView";
import { Shell } from "@/components/Shell";

export default function HostPage() {
  return (
    <Shell>
      <Suspense fallback={<p className="text-muted pt-10 text-center">Loading…</p>}>
        <HostView />
      </Suspense>
    </Shell>
  );
}

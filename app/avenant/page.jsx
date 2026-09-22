"use client";

import { Suspense } from "react";
import { AvenantEditor } from "./AvenantEditor";

export default function AvenantPage() {
  return (
    <Suspense fallback={null}>
      <AvenantEditor />
    </Suspense>
  );
}

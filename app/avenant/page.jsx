"use client";

import { Suspense } from "react";
import { AvenantRoute } from "./AvenantEditor";

export default function AvenantPage() {
  return (
    <Suspense fallback={null}>
      <AvenantRoute />
    </Suspense>
  );
}

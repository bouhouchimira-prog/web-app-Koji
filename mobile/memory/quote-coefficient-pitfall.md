---
name: quote-coefficient-pitfall
description: Quote pricing must use RealityFactors.totalCoefficient, not .condition
metadata:
  type: project
---

In the quote/devis pricing flow, the chantier coefficient is `RealityFactors.totalCoefficient` (= access × condition × surface), defined in lib/features/pricing/models/pricing_models.dart. The UI badge "Paramètres du chantier (Coeff: X)" in room_task_screen.dart displays `totalCoefficient`.

**Why:** Earlier code computed labor price using only the `.condition` sub-factor, silently dropping access/surface — so the price applied a different (smaller) coefficient than the badge showed. Fixed 2026-05-22 to use `totalCoefficient` in room_task_screen.dart's `_buildHoursInput` and `_onContinue` serialization.

**How to apply:** Labor price = qty × tempsHU(per-unit) × tauxHoraire × totalCoefficient. `state.hours` / stored `hours` is PER-UNIT (h/u), never total — do not divide by quantity when computing unit cost. The Récapitulatif (quote_detail_screen.dart) reads stored `conditionCoeff` and recomputes; it ignores the `expenses`/`roomEstimations` map entirely.

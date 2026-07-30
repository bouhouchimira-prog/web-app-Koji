import { NextResponse } from "next/server";
import { badRequest } from "../../../../lib/http";
import { getUserScope, readDb, scopedItems } from "../../../../lib/db";
import { buildWorkerHoursPdf, workerHoursDocumentFilename } from "../../../../lib/document-generator";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  const url = new URL(request.url);
  const workerId = url.searchParams.get("workerId") || "";
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);

  const worker = scopedItems(db.workers, userId).find((item) => item.id === workerId);
  if (!worker) return badRequest("Ouvrier introuvable.", 404);

  const entries = scopedItems(db.attendanceEntries, userId).filter((entry) => entry.workerId === workerId);
  const pdfBuffer = buildWorkerHoursPdf({ worker, entries, month, db });
  const filename = workerHoursDocumentFilename(worker, month);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const p = path.resolve(process.cwd(), "out/ufoval/ufoval_enrichment_full.json");
  if (!fs.existsSync(p)) {
    return NextResponse.json(
      { ok: false, error: "ufoval_enrichment_full.json not found. Run merge script first." },
      { status: 404 }
    );
  }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return NextResponse.json({ ok: true, ...j });
}

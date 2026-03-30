const fs = require("fs");
const path = require("path");

const depPath = path.resolve("out/ufoval/ufoval_departures_prices.json");
const sesPath = path.resolve("out/ufoval/ufoval_sessions.json");
const outPath = path.resolve("out/ufoval/ufoval_enrichment_full.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}
function normUrl(u) {
  return String(u || "")
    .trim()
    .replace(/\/+$/, ""); // remove trailing slash
}

function main() {
  if (!fs.existsSync(depPath)) throw new Error("Missing: " + depPath);
  if (!fs.existsSync(sesPath)) throw new Error("Missing: " + sesPath);

  const dep = readJson(depPath);
  const ses = readJson(sesPath);

  // departures file: array OR {results:[]}
  const depResults = Array.isArray(dep) ? dep : (dep.results || dep.data || []);
  // sessions file: {results:[]}
  const sesResults = Array.isArray(ses) ? ses : (ses.results || []);

  // Index sessions by source_url (most reliable)
  const sessionsByUrl = new Map();
  for (const r of sesResults) {
    const u = normUrl(r.source_url);
    if (u) sessionsByUrl.set(u, r);
  }

  let hit = 0;
  let miss = 0;

  const merged = depResults.map((d) => {
    const u = normUrl(d.source_url || d.sourceUrl);
    const s = sessionsByUrl.get(u);

    const departures = d.departures || d.departureOptions || d.departure_options || d.departure || null;
    const sessions = s?.sessions || [];

    if (sessions.length) hit++;
    else miss++;

    return {
      id: d.id || d.slug || null,
      source_url: u || null,
      departures,
      sessions,
      meta: {
        has_departures: !!departures,
        sessions_count: sessions.length,
      },
    };
  });

  const out = {
    generatedAt: new Date().toISOString(),
    total: merged.length,
    match_sessions_ok: hit,
    match_sessions_missing: miss,
    items: merged,
  };

  writeJson(outPath, out);
  console.log("DONE ->", outPath);
  console.log("total:", out.total, "sessions ok:", hit, "missing:", miss);
}

main();

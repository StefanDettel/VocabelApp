/* Vocabula – wandelt die Texterkennung (Zeilen mit Wortpositionen) in
   Tabellenzeilen um: erkennt Spalten (Latein | Deutsch | Fremdsprachen …). */
(function (root) {
"use strict";
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const clean = t => String(t || "").replace(/[|_~»«„“”"`]/g, "").replace(/\s+/g, " ").replace(/^[\s.,;:–-]+|[\s,;:–-]+$/g, "").trim();

// lines: [{bbox:{x0,y0,x1,y1}, words:[{text, bbox, confidence}]}], width: image width
function toRows(lines, width) {
  const L = lines.map(l => ({ y: l.bbox.y0, h: Math.max(1, l.bbox.y1 - l.bbox.y0), words: (l.words || []).filter(w => clean(w.text) && (w.confidence ?? 100) > 20) }))
                 .filter(l => l.words.length);
  if (!L.length) return { rows: [], columns: 0, title: "" };
  const hMed = median(L.map(l => l.h));
  // 1) Zeilen an großen Lücken in Abschnitte teilen
  const segLines = L.map(l => {
    const ws = l.words.slice().sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const segs = []; let cur = null;
    const gapLimit = Math.max(hMed * 1.6, width * 0.035);
    for (const w of ws) {
      if (cur && w.bbox.x0 - cur.x1 <= gapLimit) { cur.text += " " + w.text; cur.x1 = w.bbox.x1; }
      else { cur = { x0: w.bbox.x0, x1: w.bbox.x1, text: w.text }; segs.push(cur); }
    }
    return { y: l.y, segs };
  });
  // 2) Spaltenanfänge sammeln und gruppieren
  const starts = segLines.flatMap(l => l.segs.map(s => s.x0)).sort((a, b) => a - b);
  const tol = Math.max(width * 0.06, hMed * 2.5);
  const clusters = [];
  for (const x of starts) { const c = clusters[clusters.length - 1]; if (c && x - c.last <= tol) { c.xs.push(x); c.last = x; } else clusters.push({ xs: [x], last: x }); }
  const minHits = Math.max(2, Math.round(segLines.length * 0.2));
  let cols = clusters.filter(c => c.xs.length >= minHits).map(c => median(c.xs));
  if (!cols.length) cols = [median(starts)];
  // 3) Abschnitte den Spalten zuordnen
  const nearest = x => { let best = 0, d = Infinity; cols.forEach((c, i) => { const dd = Math.abs(c - x); if (dd < d) { d = dd; best = i; } }); return best; };
  let rows = segLines.map(l => { const cells = cols.map(() => ""); for (const s of l.segs) { const i = nearest(s.x0); cells[i] = clean(cells[i] ? cells[i] + " " + s.text : s.text); } return cells; });
  // Einspaltig? Dann an Trennzeichen teilen ("amicus – Freund")
  if (cols.length === 1) {
    rows = rows.map(r => { const m = r[0].split(/\s+[–—-]\s+|\s+=\s+|\t|:\s+/); return m.length > 1 ? [clean(m[0]), clean(m.slice(1).join(", "))] : [r[0], ""]; });
    cols = [0, 1];
  }
  // 4) Titel & Fortsetzungszeilen
  let title = "";
  const out = [];
  for (const r of rows) {
    const filled = r.filter(Boolean).length;
    if (filled === 1 && r[0] && /^(lektion|lectio|kapitel|caput|l\.?\s*\d)/i.test(r[0])) { if (!title) title = r[0]; continue; }
    if (!r[0] && out.length) { r.forEach((c, i) => { if (c) out[out.length - 1][i] = clean(out[out.length - 1][i] + " " + c); }); continue; }
    if (!filled) continue;
    out.push(r.slice());
  }
  return { rows: out, columns: cols.length, title };
}

const API = { toRows };
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.OcrParse = API;
})(typeof self !== "undefined" ? self : this);

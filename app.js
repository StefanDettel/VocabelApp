/* Vocabula – eigenständige Latein-Lern-App (offline, ohne Konto). */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const abs = p => new URL(p, location.href).href;
const GRADE_NAMES = {1:"sehr gut",2:"gut",3:"befriedigend",4:"ausreichend",5:"mangelhaft",6:"ungenügend"};

const EXAMPLE = { id: "example", example: true, name: "Beispiel: Lektion 1", created: 0, words: [
  {la:"amicus, amici m.", de:"Freund"}, {la:"villa, villae f.", de:"Landhaus, Villa"}, {la:"servus, servi m.", de:"Sklave, Diener"},
  {la:"dominus, domini m.", de:"Herr"}, {la:"puella, puellae f.", de:"Mädchen"}, {la:"forum, fori n.", de:"Forum, Marktplatz"},
  {la:"laborare, laboro", de:"arbeiten"}, {la:"clamare, clamo", de:"rufen, schreien"}, {la:"videre, video", de:"sehen"}, {la:"ridere, rideo", de:"lachen"},
  {la:"venire, venio", de:"kommen"}, {la:"exspectare, exspecto", de:"erwarten, warten auf"}, {la:"magnus, a, um", de:"groß"}, {la:"laetus, a, um", de:"froh, fröhlich"},
  {la:"et", de:"und"}, {la:"sed", de:"aber, sondern"}, {la:"non", de:"nicht"}, {la:"hodie", de:"heute"}
]};

/* ---------------- Speicher (nur auf diesem Gerät) ---------------- */
const state = {
  lists: [], settings: { grades: {1:0,2:2,3:4,4:6,5:8} }, results: [],
  tab: "quiz", quiz: null, quizSetup: { sel: null, dir: "la", count: "20" },
  text: null, textSetup: { sel: null, len: "mittel" }, draft: null, confirmDel: null, confirmImport: null
};
const LS = "vocabula.v1";
function load(){ try { const j = JSON.parse(localStorage.getItem(LS) || "null"); if (j) { state.lists = j.lists || []; Object.assign(state.settings, j.settings || {}); state.results = j.results || []; } } catch(e){} }
function save(){ try { localStorage.setItem(LS, JSON.stringify({ lists: state.lists, settings: state.settings, results: state.results.slice(0, 100) })); } catch(e){ toast("Speichern fehlgeschlagen – Speicher voll?"); } }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

function allLists(){ return state.lists.length ? state.lists : [EXAMPLE]; }
function listById(id){ return allLists().find(l => l.id === id); }
function selectedWords(sel){ const out = []; for (const id of sel) { const l = listById(id); if (l) out.push(...l.words); } return out; }
function defaultSel(){ const l = allLists(); return l.length ? [l[l.length - 1].id] : []; }
function gradeFor(errors){ const g = state.settings.grades; for (let n = 1; n <= 5; n++) { const v = Number(g[n]); if (Number.isFinite(v) && errors <= v) return n; } return 6; }
function addResult(r){ state.results.unshift(r); save(); }

let tt; function toast(msg){ let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role","status"); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 3000); }

/* ---------------- Navigation ---------------- */
document.querySelectorAll("nav.tabs button").forEach(b => b.addEventListener("click", () => { state.tab = b.dataset.tab; state.confirmDel = null; render(); window.scrollTo(0, 0); }));
function render(){
  for (const t of ["quiz","text","lists","grades"]) $("#v-" + t).hidden = state.tab !== t;
  document.querySelectorAll("nav.tabs button").forEach(b => { if (b.dataset.tab === state.tab) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  ({ quiz: renderQuiz, text: renderText, lists: renderLists, grades: renderGrades })[state.tab]();
}
function listChips(name, sel){
  return `<div class="chips">${allLists().map(l => `<label class="chip"><input type="checkbox" name="${name}" value="${esc(l.id)}" ${sel.includes(l.id) ? "checked" : ""}>${esc(l.name)} <span class="muted">${l.words.length}</span></label>`).join("")}</div>`;
}
const readChips = (root, name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
function stampHTML(g){ return `<div class="stamp g${g}" aria-label="Note ${g}"><span>Note</span><b>${g}</b><span>${GRADE_NAMES[g]}</span></div>`; }

/* =================== ABFRAGE =================== */
function renderQuiz(){
  const v = $("#v-quiz"); const q = state.quiz;
  if (!state.quizSetup.sel) state.quizSetup.sel = defaultSel();
  if (!q) {
    const s = state.quizSetup;
    v.innerHTML = `
      <div class="card">
        <h2>Vokabeltest</h2>
        ${state.lists.length ? "" : `<p class="muted">Noch keine eigenen Vokabeln – unten ist eine <span class="badge">Beispiel</span>-Lektion. Eigene Seiten fotografierst du unter „Vokabeln“.</p>`}
        <div class="stack"><h3>Lektionen</h3>${listChips("qsel", s.sel)}</div>
        <div class="stack"><h3>Richtung</h3><div class="seg" role="radiogroup">
          ${[["la","Latein → Deutsch"],["de","Deutsch → Latein"],["mix","gemischt"]].map(([k,t]) => `<label><input type="radio" name="qdir" value="${k}" ${s.dir === k ? "checked" : ""}>${t}</label>`).join("")}
        </div></div>
        <div class="stack"><h3>Anzahl Wörter</h3><div class="seg" role="radiogroup">
          ${[["10","10"],["20","20"],["30","30"],["all","alle"]].map(([k,t]) => `<label><input type="radio" name="qcnt" value="${k}" ${s.count === k ? "checked" : ""}>${t}</label>`).join("")}
        </div></div>
        <p class="muted" id="qinfo"></p>
        <button class="primary" id="qstart">Test starten</button>
      </div>`;
    const upd = () => { s.sel = readChips(v, "qsel"); s.dir = $("input[name=qdir]:checked", v).value; s.count = $("input[name=qcnt]:checked", v).value;
      const n = selectedWords(s.sel).length; const take = s.count === "all" ? n : Math.min(n, +s.count);
      $("#qinfo").textContent = n ? `${take} von ${n} Vokabeln, in zufälliger Reihenfolge.` : "Wähle mindestens eine Lektion.";
      $("#qstart").disabled = !n; };
    v.onchange = upd; upd();
    $("#qstart").onclick = () => {
      const words = shuffle(selectedWords(s.sel)); const take = s.count === "all" ? words.length : Math.min(words.length, +s.count);
      state.quiz = { items: words.slice(0, take).map(w => ({ ...w, dir: s.dir === "mix" ? (Math.random() < .5 ? "la" : "de") : s.dir })), i: 0, shown: false, wrong: [], typed: "", done: false,
        names: s.sel.map(id => listById(id)?.name).filter(Boolean).join(", ") };
      renderQuiz();
    };
    return;
  }
  v.onchange = null;
  if (q.done) return renderQuizResult();
  const it = q.items[q.i]; const ask = it.dir === "la" ? it.la : it.de; const sol = it.dir === "la" ? it.de : it.la;
  v.innerHTML = `
    <div class="card">
      <div class="qmeta"><span>Wort ${q.i + 1} von ${q.items.length}</span><span>${q.wrong.length} Fehler</span></div>
      <div class="progress"><i style="width:${(q.i / q.items.length) * 100}%"></i></div>
      <div class="tablet"><span class="dir">${it.dir === "la" ? "Übersetze ins Deutsche" : "Wie heißt das auf Latein?"}</span>
        <span class="word" ${it.dir === "de" ? 'style="font-family:var(--body);font-size:28px"' : ""}>${esc(ask)}</span></div>
      ${q.shown ? `
        ${q.typed ? `<p class="yours">Deine Antwort: <b>${esc(q.typed)}</b></p>` : ""}
        <div class="answer ${it.dir === "de" ? "latin" : ""}">${esc(sol)}</div>
        <p class="muted" style="text-align:center">Hattest du es richtig?</p>
        <div class="row"><button class="bad grow" id="qno">✗ Falsch</button><button class="good grow" id="qyes">✓ Richtig</button></div>
      ` : `
        <input type="text" id="qtyped" placeholder="Deine Antwort (optional)" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(q.typed)}">
        <button class="primary" id="qshow">Lösung zeigen</button>
      `}
      <button class="ghost small" id="qquit">Test abbrechen</button>
    </div>`;
  if (!q.shown) { const inp = $("#qtyped"); inp.addEventListener("keydown", e => { if (e.key === "Enter") $("#qshow").click(); });
    $("#qshow").onclick = () => { q.typed = inp.value.trim(); q.shown = true; renderQuiz(); }; }
  else {
    const next = wrong => { if (wrong) q.wrong.push(it); q.i++; q.shown = false; q.typed = "";
      if (q.i >= q.items.length) { q.done = true; const errors = q.wrong.length;
        addResult({ id: uid("r"), at: Date.now(), kind: "vokabeln", label: q.names, total: q.items.length, errors, grade: gradeFor(errors) }); }
      renderQuiz(); };
    $("#qyes").onclick = () => next(false); $("#qno").onclick = () => next(true);
  }
  $("#qquit").onclick = () => { state.quiz = null; renderQuiz(); };
}
function renderQuizResult(){
  const q = state.quiz; const e = q.wrong.length; const g = gradeFor(e);
  $("#v-quiz").innerHTML = `
    <div class="card">
      <h2>Ergebnis</h2>
      <div class="result">${stampHTML(g)}
        <div class="stack"><p style="font-size:20px;font-weight:700">${e} Fehler bei ${q.items.length} Wörtern</p>
        <p class="muted">${q.items.length - e} richtig · Bewertung nach eurer Notentabelle</p></div></div>
      ${e ? `<h3>Das übst du nochmal</h3><div class="miss">${q.wrong.map(w => `<div><b>${esc(w.la)}</b><span>${esc(w.de)}</span></div>`).join("")}</div>` : `<p>Alles gewusst. Optime!</p>`}
      <div class="row">${e ? `<button class="primary grow" id="qretry">Falsche wiederholen</button>` : ""}<button class="grow" id="qnew">Neuer Test</button></div>
    </div>`;
  $("#qnew").onclick = () => { state.quiz = null; renderQuiz(); };
  const r = $("#qretry"); if (r) r.onclick = () => { state.quiz = { items: shuffle(q.wrong), i: 0, shown: false, wrong: [], typed: "", done: false, names: q.names + " (Wiederholung)" }; renderQuiz(); };
}

/* =================== ÜBERSETZEN =================== */
let nounsPromise = null;
function ensureNouns(){
  if (TextGen._isLoaded()) return Promise.resolve();
  if (!nounsPromise) nounsPromise = fetch("data/nouns.txt").then(r => { if (!r.ok) throw new Error("http"); return r.text(); }).then(t => TextGen.loadNouns(t)).catch(e => { nounsPromise = null; throw e; });
  return nounsPromise;
}
function renderText(){
  const v = $("#v-text"); const s = state.textSetup; const t = state.text;
  if (!s.sel) s.sel = defaultSel();
  if (!t) {
    v.innerHTML = `
      <div class="card">
        <h2>Übersetzungstext</h2>
        <p class="muted">Die App baut aus deinen Vokabeln einen kurzen lateinischen Text. Du übersetzt ihn ins Deutsche und schaust dir dann die Lösung an.</p>
        <div class="stack"><h3>Lektionen</h3>${listChips("tsel", s.sel)}</div>
        <div class="stack"><h3>Länge</h3><div class="seg" role="radiogroup">
          ${[["kurz","kurz · 4 Sätze"],["mittel","mittel · 6"],["lang","lang · 9"]].map(([k,t]) => `<label><input type="radio" name="tlen" value="${k}" ${s.len === k ? "checked" : ""}>${t}</label>`).join("")}
        </div></div>
        <button class="primary" id="tgen">Text erstellen</button>
        <p class="muted">Tipp: Je mehr Vokabeln mit Grammatikangaben (z. B. „servus, servi m.“ oder „videre, video“), desto abwechslungsreicher die Texte.</p>
      </div>`;
    const upd = () => { s.sel = readChips(v, "tsel"); s.len = $("input[name=tlen]:checked", v).value; $("#tgen").disabled = !selectedWords(s.sel).length; };
    v.onchange = upd; upd();
    $("#tgen").onclick = generateText;
    return;
  }
  v.onchange = null;
  const latin = t.sentences.map(x => esc(x.la)).join(" ");
  v.innerHTML = `
    <div class="card">
      <div class="latintext"><span class="ttl">${esc(t.title.la)}</span>${latin}</div>
      ${t.hints.length ? `<details><summary class="muted">Hilfe: Namen und Zusatzwörter (${t.hints.length})</summary><div class="hints" style="margin-top:8px">${t.hints.map(h => `<span><b style="font-family:var(--latin);font-size:16px">${esc(h.la)}</b> – ${esc(h.de)}</span>`).join("")}</div></details>` : ""}
      <label class="lbl">Deine Übersetzung<textarea id="tmine" placeholder="Schreib hier deine deutsche Übersetzung …">${esc(t.mine || "")}</textarea></label>
      ${t.shown ? `
        <h3>Lösung · ${esc(t.title.de)}</h3>
        <div class="solution">${t.sentences.map(x => `<div class="sent"><span class="l">${esc(x.la)}</span><span class="d">${esc(x.de)}</span></div>`).join("")}</div>
        <div class="stack"><h3>Deine Fehler</h3>
          <div class="stepper"><button class="small" id="tminus" aria-label="Ein Fehler weniger">−</button><output id="terr">${t.errors}</output><button class="small" id="tplus" aria-label="Ein Fehler mehr">+</button></div>
          <p class="muted">Vergleiche Satz für Satz. Ein Fehler = ein falsch oder nicht übersetztes Wort oder eine falsche Form.</p>
        </div>
        ${t.graded ? `<div class="result">${stampHTML(t.graded)}<p style="font-weight:700">${t.errors} Fehler</p></div>` : `<button class="primary" id="tgrade">Note berechnen</button>`}
      ` : `<button class="primary" id="tshow">Lösung zeigen</button>`}
      <div class="row"><button class="grow" id="tnew">Neuer Text</button><button class="ghost grow" id="tback">Zurück</button></div>
    </div>`;
  const mine = $("#tmine"); mine.oninput = () => t.mine = mine.value;
  if (!t.shown) $("#tshow").onclick = () => { t.shown = true; renderText(); };
  else {
    $("#tminus").onclick = () => { t.errors = Math.max(0, t.errors - 1); t.graded = null; renderText(); };
    $("#tplus").onclick = () => { t.errors++; t.graded = null; renderText(); };
    const g = $("#tgrade"); if (g) g.onclick = () => { t.graded = gradeFor(t.errors); addResult({ id: uid("r"), at: Date.now(), kind: "text", label: t.title.la, total: null, errors: t.errors, grade: t.graded }); renderText(); };
  }
  $("#tnew").onclick = generateText;
  $("#tback").onclick = () => { state.text = null; renderText(); };
}
async function generateText(){
  const s = state.textSetup; const words = selectedWords(s.sel); if (!words.length) return;
  const btn = $("#tgen"); if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Text wird gebaut …'; }
  try { await ensureNouns(); }
  catch(e){ toast("Das Wörterbuch konnte nicht geladen werden. Einmal mit Internet öffnen, danach geht es offline."); if (btn) { btn.disabled = false; btn.textContent = "Text erstellen"; } return; }
  const r = TextGen.generate(words, { length: s.len });
  if (r.error) { state.text = null; renderText(); toast(r.error); return; }
  state.text = { ...r, shown: false, errors: 0, mine: "", graded: null };
  renderText(); window.scrollTo(0, 0);
}

/* =================== VOKABELN =================== */
function renderLists(){
  const v = $("#v-lists"); if (state.draft) return renderDraft();
  v.innerHTML = `
    <div class="card">
      <h2>Vokabeln scannen</h2>
      <p class="muted">Fotografiere die Vokabelseite aus dem Buch oder Heft – möglichst gerade, hell und scharf. Die App liest die Wörter direkt auf dem iPhone aus, du prüfst sie und speicherst sie als Lektion.</p>
      <input type="file" id="fcam" accept="image/*" capture="environment" hidden>
      <input type="file" id="fpick" accept="image/*" multiple hidden>
      <div class="btnrow2">
        <button class="primary" id="bcam"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Foto aufnehmen</button>
        <button id="bpick">Aus Fotos wählen</button>
      </div>
      <button class="ghost" id="bmanual">Vokabeln eintippen oder einfügen</button>
    </div>
    <div class="card">
      <h2>Deine Lektionen</h2>
      <div>${allLists().map(l => `
        <div class="listitem">
          <div class="grow"><div class="name">${esc(l.name)} ${l.example ? '<span class="badge">Beispiel</span>' : ""}</div><div class="muted">${l.words.length} Vokabeln</div></div>
          <button class="small" data-edit="${esc(l.id)}">${l.example ? "Ansehen" : "Bearbeiten"}</button>
        </div>`).join("")}</div>
      ${state.lists.length ? "" : `<p class="muted">Sobald du eine eigene Lektion speicherst, verschwindet das Beispiel.</p>`}
    </div>`;
  const onFiles = inp => () => { const files = [...inp.files]; inp.value = ""; if (files.length) scanPhotos(files); };
  $("#fcam").onchange = onFiles($("#fcam")); $("#fpick").onchange = onFiles($("#fpick"));
  $("#bcam").onclick = () => $("#fcam").click(); $("#bpick").onclick = () => $("#fpick").click();
  $("#bmanual").onclick = () => { state.draft = { id: null, name: nextName(), words: [], paste: true }; renderLists(); };
  v.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { const l = listById(b.dataset.edit);
    state.draft = { id: l.example ? null : l.id, name: l.example ? "Lektion 1" : l.name, words: l.words.map(w => ({ ...w })), created: l.created }; state.confirmDel = null; renderLists(); });
}
function nextName(){ return "Lektion " + (state.lists.length + 1); }
function parsePaste(txt){
  const out = [];
  for (let line of txt.split(/\r?\n/)) { line = line.trim(); if (!line) continue;
    const m = line.split(/\s*(?:\t|\s[–—-]\s|\s=\s|:\s|;\s)\s*/);
    if (m.length >= 2) out.push({ la: m[0].trim(), de: m.slice(1).join(", ").trim() });
  }
  return out;
}
function applyColumns(d){
  const la = +d.colLa, de = +d.colDe;
  d.words = d.rows.map(r => ({ la: r[la] || "", de: r[de] || "" })).filter(w => w.la || w.de);
}
function renderDraft(){
  const v = $("#v-lists"); const d = state.draft;
  const colOpts = sel => d.cols.map((c, i) => `<option value="${i}" ${+sel === i ? "selected" : ""}>Spalte ${i + 1}: ${esc(c)}</option>`).join("");
  v.innerHTML = `
    <div class="card">
      <h2>${d.id ? "Lektion bearbeiten" : "Neue Lektion"}</h2>
      ${d.thumbs?.length ? `<div class="thumbs">${d.thumbs.map(u => `<img src="${u}" alt="Foto">`).join("")}</div>` : ""}
      ${d.scanning ? `<div class="stack"><p class="row"><span class="spin"></span> <span id="ocrmsg">${esc(d.msg || "Texterkennung startet …")}</span></p><div class="ocrbar"><i id="ocrbar" style="width:${Math.round((d.pct || 0) * 100)}%"></i></div>
        <p class="muted">Beim allerersten Scan lädt die App einmalig die Texterkennung (ca. 10 MB). Danach geht es auch ohne Internet.</p></div>` : ""}
      ${d.cols && d.cols.length > 2 && !d.scanning ? `<div class="stack"><h3>Welche Spalte ist was?</h3><div class="colmap">
        <label class="lbl">Latein<select id="colla">${colOpts(d.colLa)}</select></label>
        <label class="lbl">Deutsch<select id="colde">${colOpts(d.colDe)}</select></label></div></div>` : ""}
      <label class="lbl">Name der Lektion<input type="text" id="dname" value="${esc(d.name)}"></label>
      ${d.paste ? `<label class="lbl">Einfügen – eine Vokabel pro Zeile, z. B. „amicus, amici m. – Freund“<textarea id="dpaste" placeholder="amicus, amici m. – Freund&#10;laborare, laboro – arbeiten"></textarea></label><button id="dadd">Übernehmen</button>` : ""}
      <div class="scroll"><table class="vtable"><tbody>
        ${d.words.map((w, i) => `<tr><td><input type="text" data-i="${i}" data-k="la" value="${esc(w.la)}" aria-label="Latein" autocapitalize="off" autocorrect="off" spellcheck="false" style="font-family:var(--latin);font-size:17px"></td><td><input type="text" data-i="${i}" data-k="de" value="${esc(w.de)}" aria-label="Deutsch"></td><td class="x"><button class="ghost small" data-del="${i}" aria-label="Zeile löschen">✕</button></td></tr>`).join("")}
      </tbody></table></div>
      ${d.scanning ? "" : `<p class="muted">${d.words.length} Vokabeln. Tippe in ein Feld, um Lesefehler zu korrigieren. Zeilen, die keine Vokabeln sind, mit ✕ löschen.</p>`}
      <div class="row"><button class="small" id="drow">+ Zeile</button>${d.paste ? "" : `<button class="small" id="dpastebtn">Text einfügen</button>`}</div>
      <div class="row"><button class="primary grow" id="dsave" ${d.words.length && !d.scanning ? "" : "disabled"}>Speichern</button><button class="grow" id="dcancel">Abbrechen</button></div>
      ${d.id ? (state.confirmDel === d.id
        ? `<div class="confirm">Lektion „${esc(d.name)}“ wirklich löschen?<button class="bad small" id="ddelyes">Ja, löschen</button><button class="small" id="ddelno">Nein</button></div>`
        : `<button class="ghost small" id="ddel" style="color:var(--bad)">Lektion löschen</button>`) : ""}
    </div>`;
  const sync = () => { const n = $("#dname"); if (n) d.name = n.value; v.querySelectorAll("input[data-i]").forEach(inp => { d.words[+inp.dataset.i][inp.dataset.k] = inp.value; }); };
  v.querySelectorAll("input").forEach(inp => inp.addEventListener("input", sync));
  const cl = $("#colla"), cd = $("#colde");
  if (cl) cl.onchange = () => { sync(); d.colLa = +cl.value; applyColumns(d); renderDraft(); };
  if (cd) cd.onchange = () => { sync(); d.colDe = +cd.value; applyColumns(d); renderDraft(); };
  v.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { sync(); d.words.splice(+b.dataset.del, 1); renderDraft(); });
  $("#drow").onclick = () => { sync(); d.words.push({ la: "", de: "" }); renderDraft(); const ins = v.querySelectorAll('input[data-k="la"]'); ins[ins.length - 1]?.focus(); };
  const pb = $("#dpastebtn"); if (pb) pb.onclick = () => { sync(); d.paste = true; renderDraft(); };
  const da = $("#dadd"); if (da) da.onclick = () => { sync(); const add = parsePaste($("#dpaste").value); if (!add.length) { toast("Keine Zeile erkannt. Format: Latein – Deutsch"); return; } d.words.push(...add); d.paste = false; renderDraft(); };
  $("#dcancel").onclick = () => { if (d.scanning) cancelScan = true; state.draft = null; state.confirmDel = null; renderLists(); };
  $("#dsave").onclick = () => { sync(); const words = d.words.map(w => ({ la: w.la.trim(), de: w.de.trim() })).filter(w => w.la && w.de);
    if (!words.length) { toast("Mindestens eine vollständige Vokabel eintragen."); return; }
    const list = { id: d.id || uid("l"), name: d.name.trim() || nextName(), words, created: d.created || Date.now() };
    const ix = state.lists.findIndex(l => l.id === list.id); if (ix >= 0) state.lists[ix] = list; else state.lists.push(list);
    save(); state.quizSetup.sel = [list.id]; state.textSetup.sel = [list.id];
    state.draft = null; renderLists(); toast(`„${list.name}“ gespeichert – ${words.length} Vokabeln`); };
  const dd = $("#ddel"); if (dd) dd.onclick = () => { sync(); state.confirmDel = d.id; renderDraft(); };
  const dy = $("#ddelyes"); if (dy) dy.onclick = () => { const id = d.id; state.lists = state.lists.filter(l => l.id !== id); save(); state.quizSetup.sel = null; state.textSetup.sel = null; state.draft = null; state.confirmDel = null; renderLists(); toast("Lektion gelöscht"); };
  const dn = $("#ddelno"); if (dn) dn.onclick = () => { state.confirmDel = null; renderDraft(); };
}

/* ---------------- Texterkennung (Tesseract, lokal) ---------------- */
let worker = null, workerPromise = null, cancelScan = false, progressCb = null;
function getWorker(){
  if (worker) return Promise.resolve(worker);
  if (!workerPromise) workerPromise = Tesseract.createWorker(["lat", "deu"], 1, {
    workerPath: abs("vendor/worker.min.js"), corePath: abs("vendor/core/"), langPath: abs("vendor/lang"), gzip: true,
    logger: m => progressCb && progressCb(m)
  }).then(w => (worker = w)).catch(e => { workerPromise = null; throw e; });
  return workerPromise;
}
let tessLoaded = null;
function loadTesseract(){
  if (window.Tesseract) return Promise.resolve();
  if (!tessLoaded) tessLoaded = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/tesseract.min.js"; s.onload = res; s.onerror = () => { tessLoaded = null; rej(new Error("load")); }; document.head.appendChild(s); });
  return tessLoaded;
}
async function prepare(file){
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const max = 2400; const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    const ctx = c.getContext("2d"); ctx.filter = "grayscale(1) contrast(1.25)"; ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.92));
    return { blob: blob || file, width: c.width, thumb: url };
  } catch(e){ return { blob: file, width: 2000, thumb: url }; }
}
async function scanPhotos(files){
  cancelScan = false;
  const d = state.draft = { id: null, name: nextName(), words: [], rows: [], scanning: true, pct: 0, msg: "Fotos werden vorbereitet …", thumbs: [] };
  renderDraft();
  const setP = (msg, pct) => { d.msg = msg; d.pct = pct; const a = $("#ocrmsg"), b = $("#ocrbar"); if (a) a.textContent = msg; if (b) b.style.width = Math.round(pct * 100) + "%"; };
  try {
    const prepped = []; for (const f of files) prepped.push(await prepare(f));
    d.thumbs = prepped.map(p => p.thumb); if (state.draft === d) renderDraft();
    setP("Texterkennung wird geladen …", 0.02);
    await loadTesseract();
    let phase = 0;
    progressCb = m => { if (state.draft !== d) return;
      if (m.status === "recognizing text") setP(`Seite ${phase + 1} von ${prepped.length} wird gelesen …`, (phase + m.progress) / prepped.length);
      else if (/load|initializ/i.test(m.status)) setP("Texterkennung wird geladen …", Math.min(0.1, (m.progress || 0) * 0.1)); };
    const w = await getWorker();
    let rowsAll = [], title = "", colCount = 0;
    for (const p of prepped) {
      if (cancelScan) return;
      const { data } = await w.recognize(p.blob);
      const r = OcrParse.toRows(data.lines || [], p.width);
      if (!title && r.title) title = r.title;
      colCount = Math.max(colCount, r.columns);
      rowsAll.push(...r.rows); phase++;
    }
    if (state.draft !== d) return;
    const width = Math.max(2, ...rowsAll.map(r => r.length));
    d.rows = rowsAll.map(r => { const x = r.slice(); while (x.length < width) x.push(""); return x; });
    d.cols = Array.from({ length: width }, (_, i) => (d.rows.find(r => r[i]) || [])[i]?.slice(0, 22) || "leer");
    d.colLa = 0; d.colDe = 1;
    applyColumns(d);
    if (title) d.name = title;
    if (!d.words.length) toast("Keine Vokabeln erkannt. Versuch ein schärferes, gerades Foto – oder tippe sie ein.");
  } catch(e){
    if (state.draft === d) toast("Die Texterkennung konnte nicht starten. Beim ersten Mal braucht die App Internet.");
  } finally { progressCb = null; }
  d.scanning = false; if (state.draft === d && state.tab === "lists") renderDraft();
}

/* =================== NOTEN =================== */
function renderGrades(){
  const v = $("#v-grades"); const g = state.settings.grades;
  const ranges = []; let lo = 0; let bad = false;
  for (let n = 1; n <= 6; n++) {
    if (n === 6) { ranges.push(`ab ${lo}`); break; }
    const hi = Number(g[n]);
    if (!Number.isFinite(hi) || hi < lo) { ranges.push("entfällt"); if (hi < lo - 1) bad = true; continue; }
    ranges.push(lo === hi ? `${lo}` : `${lo} – ${hi}`); lo = hi + 1;
  }
  v.innerHTML = `
    <div class="card">
      <h2>Notentabelle</h2>
      <p class="muted">Trag pro Note ein, bis zu wie vielen Fehlern sie gilt. Alles darüber ist eine 6. Gilt für Vokabeltests und Übersetzungen.</p>
      <div class="scroll"><table class="gtable">
        <thead><tr><th>Note</th><th>bis … Fehler</th><th>Fehlerbereich</th></tr></thead>
        <tbody>${[1,2,3,4,5,6].map((n, i) => `<tr><td class="n">${n}</td>
          <td>${n < 6 ? `<input type="number" inputmode="numeric" min="0" step="1" id="g${n}" value="${esc(g[n])}" aria-label="Note ${n}: bis wie viele Fehler">` : `<span class="muted">mehr</span>`}</td>
          <td class="range">${esc(ranges[i] || "")} <span class="muted">· ${GRADE_NAMES[n]}</span></td></tr>`).join("")}</tbody>
      </table></div>
      ${bad ? `<p class="warn">Die Werte sollten von Note 1 bis 5 ansteigen.</p>` : ""}
    </div>
    <div class="card">
      <h2>Verlauf</h2>
      ${state.results.length ? `<div class="hist">${state.results.slice(0, 40).map(r => `
        <div class="h"><div><b>${r.kind === "text" ? "Übersetzung" : "Vokabeltest"}</b> <span class="muted">· ${esc(r.label || "")}</span><div class="muted">${new Date(r.at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} · ${r.errors} Fehler${r.total ? ` / ${r.total} Wörter` : ""}</div></div>
        <span></span><span class="g" aria-label="Note ${r.grade}">${r.grade}</span></div>`).join("")}</div>`
      : `<p class="muted">Hier erscheinen die Noten deiner Tests.</p>`}
    </div>
    <div class="card">
      <h2>Datensicherung</h2>
      <p class="muted">Alles bleibt nur auf diesem iPhone. Sichere ab und zu eine Kopie, z. B. in „Dateien“ oder per AirDrop – damit lassen sich die Daten auch auf ein neues Gerät übertragen.</p>
      <div class="btnrow2"><button id="bexport">Sicherung speichern</button><button id="bimport">Sicherung laden</button></div>
      <input type="file" id="fimport" accept="application/json,.json" hidden>
      ${state.confirmImport ? `<div class="confirm">Sicherung mit ${state.confirmImport.lists.length} Lektionen laden? Die aktuellen Daten werden ersetzt.<button class="bad small" id="impyes">Ja, laden</button><button class="small" id="impno">Nein</button></div>` : ""}
    </div>
    <p class="foot">Vocabula · Texterkennung: Tesseract (Apache 2.0) · Deutsches Wörterbuch: german-nouns / Wiktionary (CC BY-SA 4.0)</p>`;
  let deb;
  for (let n = 1; n <= 5; n++) $("#g" + n).addEventListener("change", e => { const val = parseInt(e.target.value, 10); g[n] = Number.isFinite(val) && val >= 0 ? val : 0; clearTimeout(deb); deb = setTimeout(save, 200); renderGrades(); });
  $("#bexport").onclick = exportData;
  $("#bimport").onclick = () => $("#fimport").click();
  $("#fimport").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (!j || !Array.isArray(j.lists)) throw 0; state.confirmImport = j; renderGrades(); }
    catch(_){ toast("Das ist keine gültige Vocabula-Sicherung."); } };
  const iy = $("#impyes"); if (iy) iy.onclick = () => { const j = state.confirmImport; state.lists = j.lists; state.settings = { ...state.settings, ...(j.settings || {}) }; state.results = j.results || []; state.confirmImport = null; state.quizSetup.sel = null; state.textSetup.sel = null; save(); renderGrades(); toast("Sicherung geladen"); };
  const ino = $("#impno"); if (ino) ino.onclick = () => { state.confirmImport = null; renderGrades(); };
}
async function exportData(){
  const data = JSON.stringify({ app: "vocabula", version: 1, exported: new Date().toISOString(), lists: state.lists, settings: state.settings, results: state.results }, null, 1);
  const name = `vocabula-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([data], name, { type: "application/json" });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Vocabula-Sicherung" }); return; } } catch(e){ if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

/* =================== Start =================== */
load(); render();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

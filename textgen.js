/* Vocabula – Offline-Satzbaukasten: baut aus Lernvokabeln grammatisch korrekte
   lateinische Sätze samt deutscher Musterübersetzung. Kein Netz, keine KI. */
(function (root) {
"use strict";

const strip = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[āēīōūȳ]/g, c => "aeiouy"["āēīōūȳ".indexOf(c)]);
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/* ---------------- German noun dictionary ---------------- */
let NOUNS = null;
function loadNouns(text) {
  NOUNS = new Map();
  for (const line of text.split("\n")) { const t = line.indexOf("\t"); if (t > 0) NOUNS.set(line.slice(0, t), line.slice(t + 1)); }
}
function deNoun(word, forcedGender) {
  let entry = NOUNS && NOUNS.get(word);
  if (!entry && !forcedGender) return null;
  const parts = (entry || forcedGender).split("|");
  const g = forcedGender || parts[0];
  const f = x => !x ? word : x[0] === "+" ? word + x.slice(1) : x;
  return { g, nom: word, gen: f(parts[1]) || word, dat: f(parts[2]), akk: f(parts[3]) };
}
const ART = { nom: { m: "der", f: "die", n: "das" }, akk: { m: "den", f: "die", n: "das" }, dat: { m: "dem", f: "der", n: "dem" }, gen: { m: "des", f: "der", n: "des" } };
function deNP(n, cas) { if (n.name) return n.de; return ART[cas][n.deN.g] + " " + n.deN[cas]; }

/* ---------------- German verbs ---------------- */
const SEP = ["hinaus", "heraus", "herein", "hinein", "heran", "herum", "hinab", "hinauf", "herab", "herauf", "voraus", "vorüber", "umher", "davon", "zurück", "zusammen", "weiter", "vorbei", "voran", "heraus", "hinein", "herbei", "entgegen", "empor", "fort", "heim", "hin", "her", "los", "weg", "nach", "mit", "vor", "zu", "an", "auf", "aus", "ein", "ab", "bei", "dar", "fest", "frei"];
const INSEP = ["be", "ge", "er", "ver", "zer", "ent", "emp", "miss", "über", "unter", "wider", "hinter"];
const STRONG = { sehen: "sieht", geben: "gibt", nehmen: "nimmt", lesen: "liest", laufen: "läuft", sprechen: "spricht", helfen: "hilft", essen: "isst", fallen: "fällt",
  halten: "hält", schlafen: "schläft", tragen: "trägt", fahren: "fährt", sein: "ist", haben: "hat", wissen: "weiß", werden: "wird", treffen: "trifft", werfen: "wirft",
  sterben: "stirbt", vergessen: "vergisst", befehlen: "befiehlt", empfehlen: "empfiehlt", stehlen: "stiehlt", laden: "lädt", raten: "rät", fangen: "fängt", lassen: "lässt",
  wollen: "will", können: "kann", müssen: "muss", dürfen: "darf", mögen: "mag", sollen: "soll", tun: "tut", schlagen: "schlägt", wachsen: "wächst", waschen: "wäscht",
  graben: "gräbt", stoßen: "stößt", brechen: "bricht", stechen: "sticht", treten: "tritt", bitten: "bittet", verderben: "verdirbt", erschrecken: "erschrickt", messen: "misst",
  fressen: "frisst", blasen: "bläst", braten: "brät", backen: "backt", gelten: "gilt", schelten: "schilt", bergen: "birgt", nennen: "nennt" };
const PL_IRR = { sein: "sind", tun: "tun" };
const TRANS = new Set(("sehen hören lieben loben rufen suchen finden erwarten fragen bitten fürchten tragen bringen nehmen haben halten kennen lesen schreiben besuchen begrüßen grüßen " +
  "verlassen fangen retten töten bauen zeigen schicken senden betrachten bewundern verteidigen angreifen beschützen schützen erreichen erzählen kaufen verkaufen essen trinken " +
  "vorbereiten bereiten tadeln strafen bestrafen führen ziehen treiben herbeirufen erblicken bemerken verstehen erkennen wecken begleiten empfangen ergreifen packen holen " +
  "öffnen schließen zerstören besiegen überwinden hassen verehren ehren pflegen heilen lehren unterrichten beherrschen regieren leiten wählen gewinnen verlieren besitzen " +
  "bewohnen bewachen beobachten anschauen ansehen vernachlässigen verachten verspotten auslachen befreien erfreuen erschrecken stören ärgern quälen schlagen verletzen " +
  "fordern verlangen erbitten anrufen herbeiholen tragen waschen verbergen verstecken zählen erwerben bewegen fassen lenken loben preisen rühmen verschonen fliehen meiden " +
  "vermeiden hindern verhindern überreden überzeugen ermahnen mahnen warnen trösten beruhigen ernähren füttern jagen verfolgen ergreifen gründen errichten schmücken " +
  "bezeichnen nennen benennen erziehen aufziehen üben ausüben pflücken sammeln tragen wegtragen herbeitragen erobern einnehmen verwüsten plündern betreten").split(" "));
const REFL_OBJ = /\b(jmdn\.?|jdn\.?|jmd\.?|jemanden|etw\.?|etwas|j-n|e-n|(?:\+|m\.)\s*akk\.?)\s*/gi;

function deVerb(meaning) {
  let s = meaning.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  let trans = REFL_OBJ.test(s); REFL_OBJ.lastIndex = 0;
  s = s.replace(REFL_OBJ, "").trim();
  let refl = false;
  if (/^sich\s/.test(s)) { refl = true; s = s.slice(5).trim(); }
  if (!/^[a-zäöüß]+$/.test(s)) return null;               // nur einfache Verben
  if (!/(en|ern|eln|n)$/.test(s) || s.length < 3) return null;
  let base = s, particle = "";
  for (const p of SEP.slice().sort((a, b) => b.length - a.length)) if (s.startsWith(p) && s.length > p.length + 3 && !INSEP.some(i => s.startsWith(i))) {
    const rest = s.slice(p.length); if (/^[a-zäöüß]+(en|ern|eln)$/.test(rest)) { particle = p; base = rest; break; }
  }
  let sg = null;
  for (const k of Object.keys(STRONG).sort((a, b) => b.length - a.length)) {
    if (base === k) { sg = STRONG[k]; break; }
    if (base.endsWith(k)) { const pre = base.slice(0, -k.length); if (INSEP.includes(pre)) { sg = pre + STRONG[k]; break; } }
  }
  if (!sg) {
    if (/(eln|ern)$/.test(base)) sg = base.slice(0, -1) + "t";
    else if (base.endsWith("en")) { const st = base.slice(0, -2);
      if (/[dt]$/.test(st) || /[^aeiouäöülrhmn][mn]$/.test(st)) sg = st + "et";
      else if (/[sßzx]$/.test(st)) sg = st + "t"; else sg = st + "t"; }
    else if (base.endsWith("n")) sg = base.slice(0, -1) + "t";
  }
  const pl = PL_IRR[base] || base;
  if (!trans) trans = TRANS.has(s) || TRANS.has(base) || /^be[a-zäöüß]{3,}en$/.test(base);
  return { inf: (refl ? "sich " : "") + s, infBare: s, sg, pl, particle, refl, trans };
}

/* ---------------- semantic helper lists (German nouns) ---------------- */
const PERSON = new Set(("Freund Freundin Sklave Sklavin Herr Herrin Mädchen Junge Knabe Sohn Tochter Vater Mutter Bruder Schwester Gast Händler Kaufmann Senator Soldat König Königin " +
  "Frau Mann Kind Lehrer Lehrerin Schüler Schülerin Bauer Bäuerin Gott Göttin Magd Diener Dienerin Bürger Bürgerin Feind Bote Arzt Ärztin Dichter Krieger Held Heldin Wächter Hirte " +
  "Greis Alte Nachbar Nachbarin Mensch Kaiser Konsul Wirt Wirtin Räuber Dieb Richter Redner Philosoph Gladiator Löwe Pferd Hund Katze Onkel Tante Großvater Großmutter Ehemann Ehefrau " +
  "Gatte Gattin Priester Priesterin Anführer Feldherr Kaufmann Fischer Koch Köchin Maler Bildhauer Sänger Sängerin Tänzerin Kunde Besucher Fremde Fremder Bewohner Einwohner Begleiter " +
  "Gefährte Gefährtin Jüngling Jugendliche Greisin Ritter Kämpfer Wagenlenker Tier Vogel Wolf Bär Stier Schüler Lehrer Geliebte Liebling Erbe Herrscher Tyrann Retter Sieger Kaufleute").split(" "));
const PLACE = { Haus: "in", Landhaus: "in", Villa: "in", Garten: "in", Forum: "auf", Markt: "auf", Marktplatz: "auf", Straße: "auf", Stadt: "in", Tempel: "in", Schule: "in",
  Wald: "in", Feld: "auf", Acker: "auf", Hof: "auf", Zimmer: "in", Küche: "in", Theater: "in", Zirkus: "in", Bad: "in", Therme: "in", Thermen: "in", Laden: "in", Kurie: "in",
  Senat: "in", Hafen: "in", Palast: "in", Lager: "in", Insel: "auf", Dorf: "in", Gasthaus: "in", Arena: "in", Amphitheater: "in", Basilika: "in", Kapitol: "auf", Hügel: "auf",
  Berg: "auf", Schiff: "auf", Wiese: "auf", Platz: "auf", Atrium: "in", Gasse: "in", Weg: "auf", Landgut: "auf", Werkstatt: "in", Laden: "in", Taverne: "in", Heiligtum: "in" };

const PERS_ADJ = new Set(("tapfer fleißig froh fröhlich traurig müde klug weise dumm zornig wütend ängstlich mutig freundlich streng gerecht ungerecht faul arm glücklich " +
  "unglücklich stolz erfreut böse gut treu untreu ehrlich höflich frech gierig hungrig durstig krank gesund erschöpft neugierig gespannt ruhig still zufrieden " +
  "erstaunt überrascht besorgt fromm grausam gnädig milde fleissig eifrig begierig vorsichtig schlau listig").split(" "));
const OBJ_PERSON = new Set(("grüßen begrüßen rufen herbeirufen lieben loben fragen bitten tadeln strafen bestrafen retten begleiten besuchen wecken trösten ermahnen mahnen " +
  "warnen beruhigen überreden überzeugen verspotten auslachen befreien erfreuen erschrecken stören ärgern quälen schlagen verletzen verteidigen beschützen empfangen erziehen " +
  "unterrichten lehren hassen verehren ehren heilen pflegen erwarten fangen führen anrufen verachten fürchten besiegen jagen verfolgen treffen").split(" "));
const OBJ_THING = new Set(("bauen kaufen verkaufen tragen bringen öffnen schließen essen trinken zerstören errichten schmücken sammeln pflücken lesen schreiben bereiten " +
  "vorbereiten waschen verbergen verstecken zählen erwerben bewohnen erobern verwüsten plündern betreten verlassen holen").split(" "));

/* ---------------- Latin parsing ---------------- */
function firstMeaning(de) { return String(de || "").split(/[,;/]| bzw\. | oder /)[0].replace(/\(.*?\)/g, "").trim(); }

function parseEntry(w) {
  const la = strip(w.la).toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const de = String(w.de || "");
  const toks = la.split(/\s*,\s*/).map(t => t.trim()).filter(Boolean);
  if (!toks.length) return null;
  const head = toks[0];
  // Verb?
  const inf = toks.find(t => /^[a-z]+(are|ere|ire)$/.test(t));
  if (inf && !/^(esse|posse|velle|nolle|malle|ferre|fieri|ire)$/.test(inf) && !/(esse|ferre)$/.test(inf) && !/(ari|eri)$/.test(inf)) {
    const first = toks.find(t => t !== inf && /^[a-z]+o$/.test(t));
    const stemI = inf.slice(0, -3);
    let conj = null, s3, p3, canPl = true;
    if (inf.endsWith("are")) { conj = "a"; s3 = stemI + "at"; p3 = stemI + "ant"; }
    else if (inf.endsWith("ire") && first && first.endsWith("eo")) { conj = "ire"; s3 = stemI + "it"; p3 = stemI + "eunt"; }
    else if (inf.endsWith("ire")) { conj = "i"; s3 = stemI + "it"; p3 = stemI + "iunt"; if (!first) canPl = false; }
    else if (first && first.endsWith("eo")) { conj = "e"; s3 = stemI + "et"; p3 = stemI + "ent"; }
    else if (first && first.endsWith("io")) { conj = "m"; s3 = first.slice(0, -2) + "it"; p3 = first.slice(0, -2) + "iunt"; }
    else if (first) { conj = "c"; s3 = first.slice(0, -1) + "it"; p3 = first.slice(0, -1) + "unt"; }
    const dv = deVerb(firstMeaning(de.replace(/^\s*(sich\s)?/, m => m)));
    const dvFull = dv || deVerb(de.split(/[,;]/)[0].trim());
    if (!dvFull) return null;
    return { type: "verb", src: w, inf, s3: conj ? s3 : null, p3: conj && canPl ? p3 : null, de: dvFull };
  }
  // Adjektiv o/a-Deklination: bonus, a, um | pulcher, pulchra, pulchrum | liber, -era, -erum
  if (toks.length >= 3 && /^-?[a-z]*a$/.test(toks[1]) && /^-?[a-z]*um$/.test(toks[2].split(" ")[0]) && /(us|er)$/.test(head)) {
    const m = head; const stem = m.endsWith("us") ? m.slice(0, -2) : m;
    const form = (t, end) => { t = t.split(" ")[0]; const bare = t.replace(/^-/, "");
      if (bare === end) return stem + end;
      if (!t.startsWith("-") && bare.slice(0, 2) === m.slice(0, 2)) return bare;
      const idx = m.lastIndexOf(bare[0]); return idx > 0 ? m.slice(0, idx) + bare : null; };
    const f = form(toks[1], "a"), n = form(toks[2], "um");
    const dA = firstMeaning(de);
    if (f && n && /^[a-zäöüß]+$/.test(dA)) return { type: "adj", src: w, m, f, n, de: dA, personal: PERS_ADJ.has(dA) };
    return null;
  }
  // Adjektiv 3. Dekl.: fortis, e | acer, acris, acre | felix, -icis / felix (Gen. felicis)
  const adj3 = la.match(/^([a-z]+)is\s*,\s*-?e\b/) || null;
  if (adj3) { const dA = firstMeaning(de); if (!/^[a-zäöüß]+$/.test(dA)) return null;
    return { type: "adj", src: w, m: adj3[1] + "is", f: adj3[1] + "is", n: adj3[1] + "e", de: dA, personal: PERS_ADJ.has(dA) }; }
  // Substantiv: nom, gen [g]
  const nm = la.match(/^([a-z]+)\s*,\s*(-?[a-z]+)\s*(?:,\s*)?(m|f|n)?\b/);
  if (nm) {
    let [, nom, gen, g] = nm; let stem, decl;
    if (gen.startsWith("-")) {
      gen = gen.slice(1);
      if (gen === "ae") gen = nom.replace(/a$/, "") + "ae";
      else if (gen === "i") gen = nom.replace(/(us|um)$/, "") + "i";
      else if (gen === "ei") gen = nom.replace(/es$/, "") + "ei";
      else if (gen === "us") gen = nom;
      else { const idx = nom.lastIndexOf(gen[0]); if (idx < 1) return null; gen = nom.slice(0, idx) + gen; }
    }
    if (gen.endsWith("ae") && nom.endsWith("a")) { decl = 1; stem = gen.slice(0, -2); g = g || "f"; }
    else if (gen.endsWith("ei") && nom.endsWith("es")) { decl = 5; stem = gen.slice(0, -2); g = g || "f"; }
    else if (gen.endsWith("i") && !gen.endsWith("is")) { decl = 2; stem = gen.slice(0, -1); g = g || (nom.endsWith("um") ? "n" : "m"); }
    else if (gen.endsWith("us") && nom.endsWith("us") && gen === nom) { decl = 4; stem = nom.slice(0, -2); g = g || "m"; }
    else if (gen.endsWith("is")) { decl = 3; stem = gen.slice(0, -2); }
    else return null;
    if (!g) return null;
    const forms = latNoun(nom, stem, decl, g);
    if (!forms) return null;
    // Deutsches Nomen
    let dm = firstMeaning(de); let forced = null;
    const art = dm.match(/^(der|die|das)\s+(.+)$/i); if (art) { forced = {der: "m", die: "f", das: "n"}[art[1].toLowerCase()]; dm = art[2].trim(); }
    if (!/^[A-ZÄÖÜ][a-zäöüß]+$/.test(dm)) return null;
    const dN = deNoun(dm, forced);
    if (!dN) return null;
    return { type: "noun", src: w, g, ...forms, deN: dN, de: dm, person: PERSON.has(dm), place: PLACE[dm] || null };
  }
  // Unveränderliches Wort (Adverb, Konjunktion …)
  return { type: "other", src: w, la: head, de: firstMeaning(de) };
}
function latNoun(nom, stem, decl, g) {
  switch (decl) {
    case 1: return { nom, gen: stem + "ae", acc: stem + "am", abl: stem + "a" };
    case 2: return g === "n" ? { nom, gen: stem + "i", acc: nom, abl: stem + "o" } : { nom, gen: stem + "i", acc: stem + "um", abl: stem + "o" };
    case 3: return { nom, gen: stem + "is", acc: g === "n" ? nom : stem + "em", abl: stem + "e" };
    case 4: return g === "n" ? null : { nom, gen: stem + "us", acc: stem + "um", abl: stem + "u" };
    case 5: return { nom, gen: stem + "ei", acc: stem + "em", abl: stem + "e" };
  }
  return null;
}

/* ---------------- built-in helpers ---------------- */
const NAMES = [
  { name: true, g: "m", nom: "Marcus", gen: "Marci", acc: "Marcum", abl: "Marco", de: "Marcus" },
  { name: true, g: "f", nom: "Iulia", gen: "Iuliae", acc: "Iuliam", abl: "Iulia", de: "Julia" },
  { name: true, g: "m", nom: "Quintus", gen: "Quinti", acc: "Quintum", abl: "Quinto", de: "Quintus" },
  { name: true, g: "f", nom: "Cornelia", gen: "Corneliae", acc: "Corneliam", abl: "Cornelia", de: "Cornelia" },
  { name: true, g: "m", nom: "Gaius", gen: "Gai", acc: "Gaium", abl: "Gaio", de: "Gaius" },
  { name: true, g: "f", nom: "Claudia", gen: "Claudiae", acc: "Claudiam", abl: "Claudia", de: "Claudia" }
];
const ADV = [["hodie", "heute"], ["nunc", "jetzt"], ["saepe", "oft"], ["subito", "plötzlich"], ["iam", "schon"], ["tum", "dann"]];
const MODAL = { vult: { s3: "vult", p3: "volunt", sg: "will", pl: "wollen", la: "velle", de: "wollen" }, debet: { s3: "debet", p3: "debent", sg: "muss", pl: "müssen", la: "debere", de: "müssen" } };
const GLUE = { et: "und", sed: "aber / sondern", non: "nicht", est: "(er/sie/es) ist", sunt: "(sie) sind", in: "in (+ Abl.: wo?)", ubi: "wo?", de: "über (+ Abl.)" };

const MOTION = /(kommen|gehen|laufen|eilen|rennen|fliehen|treten|kehren|fahren|reiten|fallen|springen|steigen|ziehen|fliegen|schwimmen|stürzen|reisen|wandern)$/;

/* ---------------- German clause builder ---------------- */
function deClause({ front, subj, verb, plural, obj, neg, modal, place, sondern }) {
  // verb: parsed deVerb; modal: MODAL entry or null
  const fin = modal ? (plural ? modal.pl : modal.sg) : (plural ? verb.pl : verb.sg);
  const refl = verb.refl ? "sich" : "";
  const rest = [];
  if (obj) rest.push(obj);
  if (neg) rest.push("nicht");
  if (place) rest.push(place);
  if (modal) rest.push(verb.infBare);
  else if (verb.particle) rest.push(verb.particle);
  let words;
  if (front) words = [cap(front), fin, ...(refl ? [refl] : []), subj, ...rest];
  else words = [subj, fin, ...(refl ? [refl] : []), ...rest];
  let s = words.join(" ");
  if (!front) s = cap(s);
  return s;
}
function dePlace(n) {
  const prep = n.place || "in";
  const art = ART.dat[n.deN.g];
  const pa = prep === "in" && art === "dem" ? "im" : prep + " " + art;
  return pa + " " + n.deN.dat;
}

/* ---------------- generator ---------------- */
function generate(words, opts = {}) {
  const want = { kurz: 4, mittel: 6, lang: 9 }[opts.length || "mittel"] || 6;
  const parsed = words.map(parseEntry).filter(Boolean);
  const nouns = parsed.filter(p => p.type === "noun");
  const verbs = parsed.filter(p => p.type === "verb");
  const adjs = parsed.filter(p => p.type === "adj");
  const persons = nouns.filter(n => n.person);
  const places = nouns.filter(n => n.place);
  const things = nouns;
  const finVerbs = verbs.filter(v => v.s3);
  const intr = finVerbs.filter(v => !v.de.trans);
  const trans = finVerbs.filter(v => v.de.trans);
  const report = { nouns: nouns.length, verbs: verbs.length, adjs: adjs.length, usable: finVerbs.length };
  if (!verbs.length && !adjs.length) return { error: "Für einen Text braucht die Auswahl mindestens ein Verb (z. B. „laborare, laboro – arbeiten“) oder ein Adjektiv (z. B. „magnus, a, um – groß“).", report };

  // Hauptpersonen: Personen aus der Liste, sonst Namen
  const cast = shuffle(persons).slice(0, 2);
  const names = shuffle(NAMES);
  while (cast.length < 3) cast.push(names.shift());
  const used = new Map();       // src -> count
  const usedGlue = new Set();
  const mark = x => { if (x && x.src) used.set(x.src, (used.get(x.src) || 0) + 1); };
  const fewest = arr => { if (!arr.length) return null; const min = Math.min(...arr.map(a => used.get(a.src) || 0)); return pick(arr.filter(a => (used.get(a.src) || 0) === min)); };
  const person = (not) => { const c = cast.filter(x => x !== not); return fewest(c.filter(x => x.src).length ? c.filter(x => x.src) : c) || pick(c); };
  const person2 = (not) => { const c = cast.filter(x => x !== not); return pick(c); };
  const objFor = (v, s) => {
    const b = v.de.infBare; const pp = cast.filter(x => x !== s); const th = things.filter(n => n !== s && !n.person);
    if (OBJ_PERSON.has(b) || OBJ_PERSON.has(b.replace(/^(be|er|ver|an|auf|aus|herbei)/, ""))) return fewest(pp.filter(x => x.src)) || pick(pp);
    if (OBJ_THING.has(b)) return fewest(th);
    return fewest([...th, ...pp.filter(x => x.src)]) || pick(pp);
  };
  const npNom = n => n.name ? n.de : deNP(n, "nom");

  const T = [];
  const adv = () => { if (Math.random() < 0.3) { const a = pick(ADV); usedGlue.add(a[0]); return a; } return null; };

  // Template functions return {la, de} or null
  const templates = {
    intr() { const v = fewest(intr.length ? intr : []); if (!v) return null; const s = person(); const a = adv(); const neg = !a && Math.random() < 0.2;
      if (neg) usedGlue.add("non"); mark(v); mark(s);
      return { la: cap([a?.[0], s.nom, neg ? "non" : null, v.s3].filter(Boolean).join(" ")) + ".",
               de: deClause({ front: a?.[1], subj: npNom(s), verb: v.de, neg }) + "." }; },
    trans() { const v = fewest(trans); if (!v) return null; const s = person(); const o = objFor(v, s); if (!o) return null;
      const a = adv(); const neg = !a && Math.random() < 0.2; if (neg) usedGlue.add("non"); mark(v); mark(s); mark(o);
      return { la: cap([a?.[0], s.nom, o.acc, neg ? "non" : null, v.s3].filter(Boolean).join(" ")) + ".",
               de: deClause({ front: a?.[1], subj: npNom(s), verb: v.de, obj: o.name ? o.de : deNP(o, "akk"), neg }) + "." }; },
    pair() { const pool = intr.filter(v => v.p3); const v = fewest(pool); if (!v) return null; const s1 = person(); const s2 = person2(s1); if (!s2) return null;
      usedGlue.add("et"); mark(v); mark(s1); mark(s2);
      return { la: cap(`${s1.nom} et ${s2.nom} ${v.p3}`) + ".", de: deClause({ subj: npNom(s1) + " und " + npNom(s2), verb: v.de, plural: true }) + "." }; },
    sed() { const pool = intr.length >= 2 ? intr : null; if (!pool) return null; const v1 = fewest(pool); mark(v1); const v2 = fewest(pool.filter(v => v !== v1)); if (!v2) return null;
      const s = person(); mark(v2); mark(s); usedGlue.add("non"); usedGlue.add("sed");
      const d2 = v2.de.sg + (v2.de.refl ? " sich" : "") + (v2.de.particle ? " " + v2.de.particle : "");
      return { la: cap(`${s.nom} non ${v1.s3}, sed ${v2.s3}`) + ".", de: deClause({ subj: npNom(s), verb: v1.de, neg: true }) + ", sondern " + d2 + "." }; },
    modal() { const v = fewest(verbs); if (!v) return null; const m = pick(Object.values(MODAL)); const s = person(); const tr = v.de.trans;
      const o = tr ? objFor(v, s) : null; if (tr && !o) return null; const a = adv();
      mark(v); mark(s); if (o) mark(o); usedGlue.add(m.s3);
      return { la: cap([a?.[0], s.nom, o ? o.acc : null, v.inf, m.s3].filter(Boolean).join(" ")) + ".",
               de: deClause({ front: a?.[1], subj: npNom(s), verb: v.de, modal: m, obj: o ? (o.name ? o.de : deNP(o, "akk")) : null }) + "." }; },
    adj() { const ad = fewest(adjs); if (!ad) return null; const n = ad.personal ? person() : (fewest(things) || person()); if (!n) return null; const form = ad[n.g]; mark(ad); mark(n); usedGlue.add("est");
      const neg = Math.random() < 0.2; if (neg) usedGlue.add("non");
      return { la: cap(`${n.nom} ${neg ? "non " : ""}${form} est`) + ".", de: cap(`${npNom(n)} ist ${neg ? "nicht " : ""}${ad.de}`) + "." }; },
    where() { const p = fewest(places); if (!p) return null; const s = person(); mark(p); mark(s); usedGlue.add("ubi"); usedGlue.add("est"); usedGlue.add("in");
      return { la: `Ubi est ${s.nom}? ${cap(s.nom)} in ${p.abl} est.`, de: `Wo ist ${npNom(s)}? ${cap(npNom(s))} ist ${dePlace(p)}.` }; },
    placeV() { const p = fewest(places); const v = fewest(intr.filter(x => !MOTION.test(x.de.infBare))); if (!p || !v) return null; const s = person(); mark(p); mark(v); mark(s); usedGlue.add("in");
      return { la: cap(`${s.nom} in ${p.abl} ${v.s3}`) + ".", de: deClause({ subj: npNom(s), verb: v.de, place: dePlace(p) }) + "." }; },
    gen() { const owner = persons.length ? fewest(persons) : null; if (!owner) return null; const n = fewest(things.filter(x => x !== owner && !x.person)); if (!n) return null;
      const ad = adjs.filter(a => !a.personal).length ? fewest(adjs.filter(a => !a.personal)) : null; const v = !ad ? fewest(intr) : null; if (!ad && !v) return null; mark(owner); mark(n); if (ad) { mark(ad); usedGlue.add("est"); } if (v) mark(v);
      const np = `${deNP(n, "nom")} ${deNP(owner, "gen")}`;
      if (ad) return { la: cap(`${n.nom} ${owner.gen} ${ad[n.g]} est`) + ".", de: cap(`${np} ist ${ad.de}`) + "." };
      return { la: cap(`${n.nom} ${owner.gen} ${v.s3}`) + ".", de: deClause({ subj: np, verb: v.de }) + "." };
    }
  };
  const order = ["intr", "trans", "adj", "where", "modal", "pair", "gen", "sed", "placeV"];
  const maxUse = { where: 1, sed: 1, pair: 2, gen: 1 }; const useCount = {};
  let guard = 0; let last = null;
  while (T.length < want && guard++ < 80) {
    // bevorzugt Vorlagen, die noch unbenutzte Wörter einbauen
    const names = shuffle(order).filter(n => n !== last && (useCount[n] || 0) < (maxUse[n] || 2));
    let made = null;
    for (const n of names) { const r = templates[n](); if (r) { made = r; last = n; useCount[n] = (useCount[n] || 0) + 1; break; } }
    if (!made) break;
    if (!T.some(t => t.la === made.la)) T.push(made);
  }
  if (!T.length) return { error: "Aus dieser Auswahl konnte kein Satz gebaut werden. Tipp: Vokabeln mit Grammatikangaben eintragen, z. B. „servus, servi m.“, „videre, video“.", report };

  const main = cast[0];
  const title = { la: "De " + main.abl, de: "Über " + (main.name ? main.de : ART.akk[main.deN.g] + " " + main.deN.akk) };
  const hints = [];
  for (const c of cast) if (c.name && T.some(t => t.la.includes(c.nom))) hints.push({ la: c.nom, de: c.de + " (Name)" });
  for (const g of usedGlue) {
    if (MODAL[g]) hints.push({ la: `${MODAL[g].s3} (von ${MODAL[g].la})`, de: `${MODAL[g].sg} (${MODAL[g].de})` });
    else if (GLUE[g]) hints.push({ la: g, de: GLUE[g] });
    else { const a = ADV.find(x => x[0] === g); if (a) hints.push({ la: a[0], de: a[1] }); }
  }
  const usedWords = [...used.keys()];
  return { title, sentences: T, hints, usedWords, report };
}

const API = { loadNouns, parseEntry, generate, deVerb, _isLoaded: () => !!NOUNS };
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.TextGen = API;
})(typeof self !== "undefined" ? self : this);

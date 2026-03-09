#!/usr/bin/env node
/**
 * Reads domains/*.yaml + terms/*.yml and generates src/terms.json
 * Term files use Backstage catalog format (multi-doc, kind: Resource).
 * Domain files use Backstage catalog format (kind: Domain).
 * Run: node scripts/build.js
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, basename } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TERMS_DIR = join(ROOT, "terms");
const DOMAINS_DIR = join(ROOT, "domains");
const JSON_PATH = join(ROOT, "src", "terms.json");

// ─── Helpers ──────────────────────────────────────────────
function unquote(s) {
  if (!s) return "";
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  return s;
}

// ─── Parse a single Backstage YAML document ───────────────
function parseBackstageDoc(text) {
  const entity = { metadata: { annotations: {}, tags: [] }, spec: {} };
  let section = null;
  let subsection = null;

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line || line.startsWith("#")) continue;

    // Top-level scalars
    const topScalar = /^(apiVersion|kind):\s*(.+)/.exec(line);
    if (topScalar) { entity[topScalar[1]] = topScalar[2].trim(); section = null; subsection = null; continue; }

    if (/^metadata:\s*$/.test(line)) { section = "metadata"; subsection = null; continue; }
    if (/^spec:\s*$/.test(line))     { section = "spec";     subsection = null; continue; }

    if (section === "metadata") {
      if (/^  annotations:\s*$/.test(line)) { subsection = "annotations"; continue; }
      if (/^  tags:\s*$/.test(line))         { subsection = "tags";        continue; }

      const metaProp = /^  (\w+):\s*(.*)/.exec(line);
      if (metaProp) {
        entity.metadata[metaProp[1]] = unquote(metaProp[2].trim());
        subsection = null;
        continue;
      }
      if (subsection === "annotations") {
        const annProp = /^    ([\w\/\-]+):\s*(.*)/.exec(line);
        if (annProp) { entity.metadata.annotations[annProp[1]] = unquote(annProp[2].trim()); continue; }
      }
      if (subsection === "tags") {
        const tagItem = /^    - (.+)/.exec(line);
        if (tagItem) { entity.metadata.tags.push(tagItem[1].trim()); continue; }
      }
    }

    if (section === "spec") {
      const specProp = /^  (\w+):\s*(.*)/.exec(line);
      if (specProp) { entity.spec[specProp[1]] = unquote(specProp[2].trim()); continue; }
    }
  }

  return entity;
}

// ─── Load domains ─────────────────────────────────────────
const FALLBACK_CONTEXTS = {
  finance:    { label: "Finance",           color: "#2563eb", icon: "💰" },
  logistics:  { label: "Logistika",         color: "#059669", icon: "📦" },
  purchasing: { label: "Nákup",             color: "#d97706", icon: "🛒" },
  it:         { label: "IT / Development",  color: "#7c3aed", icon: "💻" },
  customer:   { label: "Zákaznický servis", color: "#dc2626", icon: "🎧" },
  hr:         { label: "HR",               color: "#0891b2", icon: "👥" },
  marketing:  { label: "Marketing",        color: "#e11d48", icon: "📣" },
};

let contexts = {};
try {
  for (const file of readdirSync(DOMAINS_DIR).filter((f) => f.endsWith(".yaml")).sort()) {
    const doc = parseBackstageDoc(readFileSync(join(DOMAINS_DIR, file), "utf-8"));
    if (doc.kind === "Domain") {
      const name = doc.metadata.name;
      contexts[name] = {
        label: doc.metadata.title || name,
        color: doc.metadata.annotations["glossary/color"] || "#6b7280",
        icon:  doc.metadata.annotations["glossary/icon"]  || "🏷️",
      };
    }
  }
} catch {
  contexts = FALLBACK_CONTEXTS;
}
if (!Object.keys(contexts).length) contexts = FALLBACK_CONTEXTS;

// ─── Load terms ───────────────────────────────────────────
const files = readdirSync(TERMS_DIR).filter((f) => f.endsWith(".yml")).sort();

const terms = [];
let defCount = 0;

for (const file of files) {
  const raw = readFileSync(join(TERMS_DIR, file), "utf-8");
  const slug = basename(file, ".yml");

  // Split multi-doc YAML on --- separator
  const docs = raw
    .split(/\n---\n/)
    .map((d) => d.trim())
    .filter(Boolean)
    .map(parseBackstageDoc)
    .filter((e) => e.kind === "Resource");

  if (!docs.length) continue;

  // Translations are repeated across all docs — read from first
  const firstAnn = docs[0].metadata.annotations;
  const translations = {
    cs: firstAnn["glossary/term-cs"] || "",
    en: firstAnn["glossary/term-en"] || "",
    ro: firstAnn["glossary/term-ro"] || "",
    it: firstAnn["glossary/term-it"] || "",
    ua: firstAnn["glossary/term-ua"] || "",
    pl: firstAnn["glossary/term-pl"] || "",
  };

  const definitions = docs.map((doc) => {
    const ann = doc.metadata.annotations;
    const obsoleteRaw = ann["glossary/obsolete"] || "";
    return {
      context: ann["glossary/domain"] || "",
      meaning: doc.metadata.description || "",
      en:      ann["glossary/en-gui"]  || "",
      enCode:  ann["glossary/en-code"] || "",
      ...(obsoleteRaw ? { obsolete: obsoleteRaw.split(";").filter(Boolean) } : {}),
    };
  });

  terms.push({ slug, term: translations.cs || slug, translations, definitions });
  defCount += definitions.length;
}

terms.sort((a, b) => a.term.localeCompare(b.term, "cs"));

const output = {
  _generated: new Date().toISOString(),
  _source: "domains/*.yaml + terms/*.yml (Backstage catalog format)",
  contexts,
  languages: {
    cs: { label: "CZ", full: "Čeština" },
    en: { label: "EN", full: "English" },
    ro: { label: "RO", full: "Română" },
    it: { label: "IT", full: "Italiano" },
    ua: { label: "UA", full: "Українська" },
    pl: { label: "PL", full: "Polski" },
  },
  terms,
};

writeFileSync(JSON_PATH, JSON.stringify(output, null, 2), "utf-8");
console.log(
  `✅ Generated ${JSON_PATH} — ${terms.length} terms, ${defCount} definitions (${files.length} files, ${Object.keys(contexts).length} domains)`
);

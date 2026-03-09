#!/usr/bin/env node
/**
 * Reads all terms/*.yml files and generates src/terms.json
 * Run: node scripts/build.js
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, basename } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TERMS_DIR = join(ROOT, "terms");
const JSON_PATH = join(ROOT, "src", "terms.json");

// ─── Minimal YAML parser for our specific structure ──────────
function parseYAML(text) {
  const result = { definitions: [] };
  let currentDef = null;
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // New list item under definitions
    if (/^\s{2}- context:\s*(.+)/.test(trimmed)) {
      currentDef = { context: RegExp.$1.trim() };
      result.definitions.push(currentDef);
      continue;
    }

    // Properties of a definition item (indented 4+)
    if (currentDef && /^\s{4}(\w+):\s*(.*)/.test(trimmed)) {
      const key = RegExp.$1;
      const val = unquote(RegExp.$2.trim());
      currentDef[key] = val;
      continue;
    }

    // Top-level key: value (not under definitions)
    if (/^(term_\w+|definitions):\s*(.*)/.test(trimmed)) {
      const key = RegExp.$1;
      const val = RegExp.$2.trim();
      if (key === "definitions") {
        currentDef = null; // reset for list parsing
      } else {
        result[key] = unquote(val);
      }
      continue;
    }
  }

  return result;
}

function unquote(s) {
  if (!s) return "";
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
  }
  return s;
}

// ─── Parse contexts.yml ──────────────────────────────────────
function parseContextsYAML(text) {
  const result = {};
  let key = null;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line || line.startsWith("#")) continue;
    const top = /^([a-z_][a-z0-9_]*):\s*$/.exec(line);
    if (top) { key = top[1]; result[key] = {}; continue; }
    if (key) {
      const prop = /^\s{2}(\w+):\s*(.+)/.exec(line);
      if (prop) result[key][prop[1]] = unquote(prop[2].trim());
    }
  }
  return result;
}

const CONTEXTS_FILE = join(ROOT, "contexts.yml");
let contexts;
try {
  contexts = parseContextsYAML(readFileSync(CONTEXTS_FILE, "utf-8"));
} catch {
  // fallback if contexts.yml is missing
  contexts = {
    finance:   { label: "Finance",           color: "#2563eb", icon: "💰" },
    logistics: { label: "Logistika",         color: "#059669", icon: "📦" },
    purchasing:{ label: "Nákup",             color: "#d97706", icon: "🛒" },
    it:        { label: "IT / Development",  color: "#7c3aed", icon: "💻" },
    customer:  { label: "Zákaznický servis", color: "#dc2626", icon: "🎧" },
    hr:        { label: "HR",               color: "#0891b2", icon: "👥" },
    marketing: { label: "Marketing",        color: "#e11d48", icon: "📣" },
  };
}

// ─── Build ───────────────────────────────────────────────────
const files = readdirSync(TERMS_DIR).filter((f) => f.endsWith(".yml")).sort();

const terms = [];
let defCount = 0;

for (const file of files) {
  const raw = readFileSync(join(TERMS_DIR, file), "utf-8");
  const parsed = parseYAML(raw);
  const slug = basename(file, ".yml");

  terms.push({
    slug,
    term: parsed.term_cs || slug,
    translations: {
      cs: parsed.term_cs || "",
      en: parsed.term_en || "",
      ro: parsed.term_ro || "",
      it: parsed.term_it || "",
      ua: parsed.term_ua || "",
      pl: parsed.term_pl || "",
    },
    definitions: (parsed.definitions || []).map((d) => ({
      context: d.context || "",
      meaning: d.meaning || "",
      en: d.en_gui || "",
      enCode: d.en_code || "",
      ...(d.obsolete
        ? { obsolete: d.obsolete.split(";").filter(Boolean) }
        : {}),
    })),
  });
  defCount += (parsed.definitions || []).length;
}

terms.sort((a, b) => a.term.localeCompare(b.term, "cs"));

const output = {
  _generated: new Date().toISOString(),
  _source: "terms/*.yml",
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
  `✅ Generated ${JSON_PATH} — ${terms.length} terms, ${defCount} definitions (from ${files.length} files)`
);

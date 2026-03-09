#!/usr/bin/env node
/**
 * One-time migration: converts terms/*.yml + contexts.yml → Backstage catalog format
 * - contexts.yml → domains/*.yaml  (kind: Domain)
 * - terms/*.yml  → multi-doc YAML  (kind: Resource, one doc per context)
 * - creates catalog-info.yaml
 *
 * Run: node scripts/migrate-backstage.js
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, basename } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TERMS_DIR = join(ROOT, "terms");
const DOMAINS_DIR = join(ROOT, "domains");

// ─── Helpers ──────────────────────────────────────────────
function unquote(s) {
  if (!s) return "";
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  return s;
}

function yamlQuote(s) {
  if (!s) return '""';
  if (/[:#\[\]{}&*!|>'"%@`\n\\]/.test(s) || s.startsWith(" ") || s.endsWith(" "))
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return s;
}

// ─── Parse old term YAML ───────────────────────────────────
function parseOldYAML(text) {
  const result = { definitions: [] };
  let currentDef = null;
  for (const line of text.split("\n")) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/^\s{2}- context:\s*(.+)/.test(trimmed)) {
      currentDef = { context: RegExp.$1.trim() };
      result.definitions.push(currentDef);
      continue;
    }
    if (currentDef && /^\s{4}(\w+):\s*(.*)/.test(trimmed)) {
      currentDef[RegExp.$1] = unquote(RegExp.$2.trim());
      continue;
    }
    if (/^(term_\w+|definitions):\s*(.*)/.test(trimmed)) {
      const key = RegExp.$1;
      if (key !== "definitions") result[key] = unquote(RegExp.$2.trim());
    }
  }
  return result;
}

// ─── Parse contexts.yml ───────────────────────────────────
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

// ─── Serializers ──────────────────────────────────────────
function domainToYAML(key, ctx) {
  return [
    "apiVersion: backstage.io/v1alpha1",
    "kind: Domain",
    "metadata:",
    `  name: ${key}`,
    `  title: ${yamlQuote(ctx.label)}`,
    "  annotations:",
    `    glossary/color: "${ctx.color}"`,
    `    glossary/icon: "${ctx.icon}"`,
    "spec:",
    "  owner: glossary-owners",
    "",
  ].join("\n");
}

function termToBackstageYAML(slug, parsed) {
  const tr = {
    cs: parsed.term_cs || "",
    en: parsed.term_en || "",
    ro: parsed.term_ro || "",
    it: parsed.term_it || "",
    ua: parsed.term_ua || "",
    pl: parsed.term_pl || "",
  };

  return parsed.definitions
    .map((def) => {
      const lines = [
        "apiVersion: backstage.io/v1alpha1",
        "kind: Resource",
        "metadata:",
        `  name: ${slug}--${def.context}`,
        `  title: ${yamlQuote(tr.en || tr.cs)}`,
        `  description: ${yamlQuote(def.meaning)}`,
        "  annotations:",
        `    glossary/term-cs: ${yamlQuote(tr.cs)}`,
        `    glossary/term-en: ${yamlQuote(tr.en)}`,
      ];
      if (tr.ro) lines.push(`    glossary/term-ro: ${yamlQuote(tr.ro)}`);
      if (tr.it) lines.push(`    glossary/term-it: ${yamlQuote(tr.it)}`);
      if (tr.ua) lines.push(`    glossary/term-ua: ${yamlQuote(tr.ua)}`);
      if (tr.pl) lines.push(`    glossary/term-pl: ${yamlQuote(tr.pl)}`);
      if (def.en_gui)  lines.push(`    glossary/en-gui: ${yamlQuote(def.en_gui)}`);
      if (def.en_code) lines.push(`    glossary/en-code: ${def.en_code}`);
      if (def.obsolete) lines.push(`    glossary/obsolete: ${yamlQuote(def.obsolete)}`);
      lines.push(`    glossary/domain: "${def.context}"`);
      lines.push("  tags:");
      lines.push("    - vocabulary");
      lines.push(`    - ${def.context}`);
      lines.push("spec:");
      lines.push("  type: vocabulary-term");
      lines.push("  owner: glossary-owners");
      lines.push(`  domain: ${def.context}`);
      return lines.join("\n");
    })
    .join("\n---\n") + "\n";
}

// ─── Run migration ────────────────────────────────────────
// 1. contexts.yml → domains/*.yaml
const contexts = parseContextsYAML(readFileSync(join(ROOT, "contexts.yml"), "utf-8"));
mkdirSync(DOMAINS_DIR, { recursive: true });
for (const [key, ctx] of Object.entries(contexts)) {
  const outFile = join(DOMAINS_DIR, `${key}.yaml`);
  writeFileSync(outFile, domainToYAML(key, ctx), "utf-8");
  console.log(`  Created domains/${key}.yaml`);
}

// 2. terms/*.yml → Backstage multi-doc
const termFiles = readdirSync(TERMS_DIR).filter((f) => f.endsWith(".yml")).sort();
for (const file of termFiles) {
  const raw = readFileSync(join(TERMS_DIR, file), "utf-8");
  const parsed = parseOldYAML(raw);
  const slug = basename(file, ".yml");
  const newContent = termToBackstageYAML(slug, parsed);
  writeFileSync(join(TERMS_DIR, file), newContent, "utf-8");
  console.log(`  Migrated terms/${file}`);
}

// 3. catalog-info.yaml
writeFileSync(
  join(ROOT, "catalog-info.yaml"),
  [
    "apiVersion: backstage.io/v1alpha1",
    "kind: Location",
    "metadata:",
    "  name: glossary",
    "  description: Domain vocabulary glossary",
    "spec:",
    "  targets:",
    "    - ./domains/*.yaml",
    "    - ./terms/*.yml",
    "",
  ].join("\n"),
  "utf-8"
);
console.log("  Created catalog-info.yaml");

console.log(`\n✅ Migration complete — ${Object.keys(contexts).length} domains, ${termFiles.length} terms`);

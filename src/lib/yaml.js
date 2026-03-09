import { slugify, yamlQuote } from "./utils";

/**
 * Serializes a term to Backstage multi-doc YAML (kind: Resource, one doc per definition).
 * termData: { translations: { cs, en, ro, it, ua, pl }, definitions: [{ context, meaning, en_gui, en_code, obsolete }] }
 */
export function termToYAML(termData) {
  const { translations, definitions } = termData;
  const slug = slugify(translations.en || translations.cs || "term");

  return definitions
    .map((def) => {
      const lines = [
        "apiVersion: backstage.io/v1alpha1",
        "kind: Resource",
        "metadata:",
        `  name: ${slug}--${def.context}`,
        `  title: ${yamlQuote(translations.en || translations.cs)}`,
        `  description: ${yamlQuote(def.meaning)}`,
        "  annotations:",
        `    glossary/term-cs: ${yamlQuote(translations.cs)}`,
        `    glossary/term-en: ${yamlQuote(translations.en)}`,
      ];
      if (translations.ro) lines.push(`    glossary/term-ro: ${yamlQuote(translations.ro)}`);
      if (translations.it) lines.push(`    glossary/term-it: ${yamlQuote(translations.it)}`);
      if (translations.ua) lines.push(`    glossary/term-ua: ${yamlQuote(translations.ua)}`);
      if (translations.pl) lines.push(`    glossary/term-pl: ${yamlQuote(translations.pl)}`);
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

/**
 * Serializes a single new domain to a Backstage Domain YAML file.
 * key: string, ctx: { label, color, icon }
 */
export function domainToYAML(key, ctx) {
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

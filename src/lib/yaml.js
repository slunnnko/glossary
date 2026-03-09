import { yamlQuote } from "./utils";

export function termToYAML(termData) {
  const lines = [];
  lines.push(`term_cs: ${yamlQuote(termData.translations.cs)}`);
  lines.push(`term_en: ${yamlQuote(termData.translations.en)}`);
  lines.push(`term_ro: ${yamlQuote(termData.translations.ro)}`);
  lines.push(`term_it: ${yamlQuote(termData.translations.it)}`);
  lines.push(`term_ua: ${yamlQuote(termData.translations.ua)}`);
  lines.push(`term_pl: ${yamlQuote(termData.translations.pl)}`);
  lines.push("");
  lines.push("definitions:");
  for (const def of termData.definitions) {
    lines.push(`  - context: ${def.context}`);
    lines.push(`    meaning: ${yamlQuote(def.meaning)}`);
    if (def.en) lines.push(`    en_gui: ${yamlQuote(def.en)}`);
    if (def.enCode) lines.push(`    en_code: ${def.enCode}`);
    if (def.obsolete?.length)
      lines.push(`    obsolete: ${yamlQuote(def.obsolete.join(";"))}`);
  }
  return lines.join("\n") + "\n";
}

export function contextsToYAML(contextMap) {
  return Object.entries(contextMap)
    .map(
      ([key, ctx]) =>
        `${key}:\n  label: ${yamlQuote(ctx.label)}\n  color: "${ctx.color}"\n  icon: "${ctx.icon}"\n`
    )
    .join("\n");
}

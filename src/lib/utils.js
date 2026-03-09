export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function yamlQuote(val) {
  if (!val) return '""';
  if (/[:#[\]{}&*!|>'"%@`,?]/.test(val) || /^\s|\s$/.test(val)) {
    return '"' + val.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }
  return val;
}

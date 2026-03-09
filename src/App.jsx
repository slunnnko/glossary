import { useState, useMemo, useCallback } from "react";
import data from "./terms.json";

const { contexts: CONTEXTS, languages: LANGUAGES, terms: TERMS } = data;

// ─── GitHub config ────────────────────────────────────────────
const GITHUB_OWNER = "slunnnko";
const GITHUB_REPO = "glossary";
// ─────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[\/\\]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function yamlQuote(val) {
  if (!val) return '""';
  if (/[:#\[\]{}&*!|>'"%@`,?]/.test(val) || /^\s|\s$/.test(val)) {
    return '"' + val.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }
  return val;
}

function termToYAML(termData) {
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

// UTF-8 safe base64 helpers
function utf8ToBase64(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

function base64ToUtf8(b64) {
  return decodeURIComponent(
    atob(b64.replace(/\s/g, ""))
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

// ─── GitHub API helper ────────────────────────────────────────
async function githubApi(path, { body, method = "GET", ...opts } = {}, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

// ─── Components ──────────────────────────────────────────────

function ContextBadge({ contextKey, size = "sm" }) {
  const ctx = CONTEXTS[contextKey];
  if (!ctx) return null;
  const cls = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${cls}`}
      style={{
        backgroundColor: ctx.color + "18",
        color: ctx.color,
        border: `1px solid ${ctx.color}33`,
      }}
    >
      <span>{ctx.icon}</span> {ctx.label}
    </span>
  );
}

function ObsoleteBadges({ items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      <span className="text-xs text-gray-400 mr-1">Obsolete:</span>
      {items.map((o) => (
        <code
          key={o}
          className="text-xs bg-red-50 text-red-400 px-1.5 py-0.5 rounded border border-red-100"
        >
          {o}
        </code>
      ))}
    </div>
  );
}

function LanguageSwitcher({ lang, setLang }) {
  const flags = { cs: "\u{1F1E8}\u{1F1FF}", en: "\u{1F1EC}\u{1F1E7}", ro: "\u{1F1F7}\u{1F1F4}", it: "\u{1F1EE}\u{1F1F9}", ua: "\u{1F1FA}\u{1F1E6}", pl: "\u{1F1F5}\u{1F1F1}" };
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
      {Object.entries(LANGUAGES).map(([k, l]) => (
        <button
          key={k}
          onClick={() => setLang(k)}
          title={l.full}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            lang === k
              ? "bg-white text-gray-900 shadow-sm font-bold"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {flags[k] || l.label}
        </button>
      ))}
    </div>
  );
}

// ─── Edit / New Term Modal ───────────────────────────────────
function EditModal({ definition, termData, isNewTerm, saving, onClose, onSave }) {
  const isNewDef = !definition;
  const [form, setForm] = useState(() => {
    if (isNewTerm) {
      return {
        term_cs: "", term_en: "", term_ro: "", term_it: "", term_ua: "", term_pl: "",
        context: "", meaning: "", en_gui: "", en_code: "", obsolete: "",
      };
    }
    return {
      context: definition?.context || "",
      meaning: definition?.meaning || "",
      en_gui: definition?.en || "",
      en_code: definition?.enCode || "",
      obsolete: (definition?.obsolete || []).join(";"),
      ...Object.fromEntries(
        Object.entries(termData.translations).map(([k, v]) => [`term_${k}`, v])
      ),
    };
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const flags = { cs: "\u{1F1E8}\u{1F1FF}", en: "\u{1F1EC}\u{1F1E7}", ro: "\u{1F1F7}\u{1F1F4}", it: "\u{1F1EE}\u{1F1F9}", ua: "\u{1F1FA}\u{1F1E6}", pl: "\u{1F1F5}\u{1F1F1}" };

  const title = isNewTerm
    ? "Add new term"
    : isNewDef
    ? "Add new definition"
    : "Edit definition";

  const subtitle = isNewTerm
    ? "Creates a new YAML file + adds you to CODEOWNERS"
    : `Changes will update terms/${termData?.slug || "..."}.yml`;

  const canSave = !saving && form.context && form.meaning && (isNewTerm ? form.term_cs && form.term_en : true);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            x
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Language translations */}
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(LANGUAGES).map(([lk, lv]) => (
              <label key={lk} className="block">
                <span className="text-xs font-medium text-gray-500">
                  {flags[lk]} {lv.full}
                  {isNewTerm && (lk === "cs" || lk === "en") && (
                    <span className="text-red-500"> *</span>
                  )}
                </span>
                <input
                  type="text"
                  value={form[`term_${lk}`] || ""}
                  onChange={(e) => set(`term_${lk}`, e.target.value)}
                  readOnly={!isNewTerm}
                  className={`mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    !isNewTerm ? "bg-gray-50 text-gray-500" : ""
                  }`}
                />
              </label>
            ))}
          </div>

          {isNewTerm && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              File will be created as <code className="font-mono">terms/{slugify(form.term_en || "...")}.yml</code>.
              You will be added to CODEOWNERS as the owner.
            </p>
          )}

          <label className="block">
            <span className="text-xs font-medium text-gray-500">Context <span className="text-red-500">*</span></span>
            <select
              value={form.context}
              onChange={(e) => set("context", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- select --</option>
              {Object.entries(CONTEXTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">
              Definition (meaning in Czech) <span className="text-red-500">*</span>
            </span>
            <textarea
              rows={3}
              value={form.meaning}
              onChange={(e) => set("meaning", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">EN (GUI label)</span>
              <input
                type="text"
                value={form.en_gui}
                onChange={(e) => set("en_gui", e.target.value)}
                className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">EN (code name)</span>
              <input
                type="text"
                value={form.en_code}
                onChange={(e) => set("en_code", e.target.value)}
                className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">
              Obsolete code names (semicolon-separated)
            </span>
            <input
              type="text"
              value={form.obsolete}
              onChange={(e) => set("obsolete", e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </label>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
            Creates a PR via GitHub API
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(form, isNewTerm, isNewDef)}
              disabled={!canSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Creating PR…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {isNewTerm ? "Create Term & PR" : isNewDef ? "Add Def & Create PR" : "Update & Create PR"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast({ data, onClose }) {
  if (!data) return null;
  const bg = data.error ? "bg-red-600" : "bg-green-600";
  return (
    <div className={`fixed bottom-4 right-4 ${bg} text-white rounded-xl shadow-2xl px-5 py-3 flex items-start gap-3 z-50 max-w-md`}>
      {data.error ? (
        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{data.title}</p>
        {data.prUrl ? (
          <a
            href={data.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs opacity-90 underline underline-offset-2 hover:opacity-100 break-all"
          >
            {data.prUrl}
          </a>
        ) : (
          <p className="text-xs opacity-80">{data.subtitle}</p>
        )}
      </div>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 shrink-0">x</button>
    </div>
  );
}

// ─── Term Card ───────────────────────────────────────────────
function TermCard({ item, lang, onEdit }) {
  const [open, setOpen] = useState(false);
  const ctxs = [...new Set(item.definitions.map((d) => d.context))];
  const display = item.translations[lang] || item.term;
  const showOrig = lang !== "cs" && item.translations[lang];
  const n = item.definitions.length;

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="text-lg font-semibold text-gray-900">{display}</span>
          {showOrig && <span className="text-sm text-gray-400">({item.term})</span>}
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">
            {n} {n === 1 ? "def" : "defs"}
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {ctxs.map((c) => (
              <ContextBadge key={c} contextKey={c} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <code className="text-xs text-gray-300 font-mono hidden sm:block">
            {item.slug}.yml
          </code>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          {/* Translation strip */}
          <div className="mb-4 flex flex-wrap gap-2 items-center pb-3 border-b border-gray-50">
            {Object.entries(item.translations).map(([lk, lv]) =>
              lv ? (
                <span
                  key={lk}
                  className={`text-xs px-2 py-0.5 rounded border ${
                    lk === lang
                      ? "bg-blue-50 text-blue-700 border-blue-200 font-semibold"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  <span className="font-bold opacity-50">{LANGUAGES[lk]?.label}:</span> {lv}
                </span>
              ) : null
            )}
          </div>
          {/* Definitions */}
          <div className="space-y-3">
            {item.definitions.map((def, i) => (
              <div key={i} className="flex gap-3 group">
                <div className="pt-0.5 shrink-0">
                  <ContextBadge contextKey={def.context} size="lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 text-sm leading-relaxed">{def.meaning}</p>
                  {def.en && (
                    <div className="mt-1.5 flex flex-wrap gap-2 items-center">
                      <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                        EN: {def.en}
                      </code>
                      {def.enCode && (
                        <code className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded border border-gray-200 font-mono">
                          {def.enCode}
                        </code>
                      )}
                    </div>
                  )}
                  <ObsoleteBadges items={def.obsolete} />
                </div>
                <button
                  onClick={() => onEdit(item, def)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-0.5 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                  title="Edit this definition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => onEdit(item, null)}
            className="mt-4 w-full py-2 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-gray-200 hover:border-blue-300 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add definition in another context
          </button>
        </div>
      )}
    </div>
  );
}

function StatsBar({ terms }) {
  const defs = terms.reduce((s, t) => s + t.definitions.length, 0);
  const multi = terms.filter(
    (t) => new Set(t.definitions.map((d) => d.context)).size > 1
  ).length;
  return (
    <div className="flex flex-wrap gap-6 text-sm text-gray-500 mb-6 bg-gray-50 rounded-xl px-5 py-3">
      <span>
        <strong className="text-gray-900">{terms.length}</strong> terms
      </span>
      <span>
        <strong className="text-gray-900">{defs}</strong> definitions
      </span>
      <span>
        <strong className="text-amber-600">{multi}</strong> multi-context
      </span>
      <span className="text-xs text-gray-400 self-center">
        Source: <code>terms/*.yml</code>
      </span>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("term");
  const [search, setSearch] = useState("");
  const [selCtx, setSelCtx] = useState(null);
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [lang, setLang] = useState("cs");
  const [editing, setEditing] = useState(null); // { termData, definition, isNewTerm }
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const token = import.meta.env.VITE_GITHUB_TOKEN || "";

  const filtered = useMemo(() => {
    let result = [...TERMS];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          Object.values(t.translations).some((v) => v && v.toLowerCase().includes(q)) ||
          t.definitions.some(
            (d) =>
              d.meaning.toLowerCase().includes(q) ||
              (d.en && d.en.toLowerCase().includes(q)) ||
              (d.enCode && d.enCode.toLowerCase().includes(q))
          )
      );
    }
    if (selCtx) {
      result = result
        .map((t) => ({
          ...t,
          definitions: t.definitions.filter((d) => d.context === selCtx),
        }))
        .filter((t) => t.definitions.length > 0);
    }
    if (onlyMulti) {
      result = result.filter((t) => {
        const orig = TERMS.find((x) => x.term === t.term);
        return orig && new Set(orig.definitions.map((d) => d.context)).size > 1;
      });
    }
    const loc = lang === "cs" ? "cs" : lang === "pl" ? "pl" : "en";
    return result.sort((a, b) =>
      (a.translations[lang] || a.term).localeCompare(b.translations[lang] || b.term, loc)
    );
  }, [search, selCtx, onlyMulti, lang]);

  const grouped = useMemo(() => {
    const g = {};
    Object.keys(CONTEXTS).forEach((c) => {
      g[c] = TERMS.filter((t) => t.definitions.some((d) => d.context === c))
        .map((t) => ({
          ...t,
          definitions: t.definitions.filter((d) => d.context === c),
        }))
        .sort((a, b) =>
          (a.translations[lang] || a.term).localeCompare(b.translations[lang] || b.term)
        );
    });
    return g;
  }, [lang]);

  const handleEdit = useCallback((termData, definition) => {
    setEditing({ termData, definition, isNewTerm: false });
  }, []);

  const handleNewTerm = useCallback(() => {
    setEditing({
      termData: { slug: "", term: "", translations: {}, definitions: [] },
      definition: null,
      isNewTerm: true,
    });
  }, []);

  const handleSave = useCallback(async (form, isNewTerm, isNewDef) => {
    if (!token) {
      setToast({ title: "Not configured", subtitle: "VITE_GITHUB_TOKEN secret is not set in GitHub Actions.", error: true });
      setTimeout(() => setToast(null), 8000);
      return;
    }

    setSaving(true);
    try {
      // 1. Get authenticated user
      const user = await githubApi("/user", {}, token);
      const login = user.login;

      // 2. Get main branch SHA
      const refData = await githubApi(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/main`,
        {},
        token
      );
      const mainSha = refData.object.sha;

      // 3. Create new branch
      const termSlug = isNewTerm ? slugify(form.term_en) : editing.termData.slug;
      const branchName = `glossary/${termSlug}-${Date.now()}`;
      await githubApi(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`,
        { method: "POST", body: { ref: `refs/heads/${branchName}`, sha: mainSha } },
        token
      );

      // 4. Build updated term data
      const newDef = {
        context: form.context,
        meaning: form.meaning,
        ...(form.en_gui ? { en: form.en_gui } : {}),
        ...(form.en_code ? { enCode: form.en_code } : {}),
        ...(form.obsolete ? { obsolete: form.obsolete.split(";").filter(Boolean) } : {}),
      };

      let updatedTermData;
      if (isNewTerm) {
        updatedTermData = {
          translations: {
            cs: form.term_cs || "",
            en: form.term_en || "",
            ro: form.term_ro || "",
            it: form.term_it || "",
            ua: form.term_ua || "",
            pl: form.term_pl || "",
          },
          definitions: [newDef],
        };
      } else if (isNewDef) {
        updatedTermData = {
          translations: editing.termData.translations,
          definitions: [...editing.termData.definitions, newDef],
        };
      } else {
        updatedTermData = {
          translations: editing.termData.translations,
          definitions: editing.termData.definitions.map((d) =>
            d === editing.definition ? newDef : d
          ),
        };
      }

      const yamlContent = termToYAML(updatedTermData);
      const base64Content = utf8ToBase64(yamlContent);
      const filePath = `terms/${termSlug}.yml`;

      // Get existing file SHA for PUT (required when updating)
      let existingFileSha;
      if (!isNewTerm) {
        const fileData = await githubApi(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=main`,
          {},
          token
        );
        existingFileSha = fileData.sha;
      }

      // Put file
      const commitMsg = isNewTerm
        ? `feat: add term "${form.term_cs}" (${form.term_en})`
        : isNewDef
        ? `feat: add ${form.context} definition to "${editing.termData.term}"`
        : `fix: update ${form.context} definition of "${editing.termData.term}"`;

      await githubApi(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
        {
          method: "PUT",
          body: {
            message: commitMsg,
            content: base64Content,
            branch: branchName,
            ...(existingFileSha ? { sha: existingFileSha } : {}),
          },
        },
        token
      );

      // 4b. For new terms, update CODEOWNERS
      if (isNewTerm) {
        const coPath = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/CODEOWNERS`;
        const newLine = `/terms/${termSlug}.yml @${login}`;
        try {
          const coData = await githubApi(`/${coPath}?ref=main`, {}, token);
          const current = base64ToUtf8(coData.content);
          const updated = current.trimEnd() + "\n" + newLine + "\n";
          await githubApi(`/${coPath}`, {
            method: "PUT",
            body: {
              message: `chore: add CODEOWNERS entry for ${form.term_en}`,
              content: utf8ToBase64(updated),
              sha: coData.sha,
              branch: branchName,
            },
          }, token);
        } catch {
          // CODEOWNERS doesn't exist yet — create it
          await githubApi(`/${coPath}`, {
            method: "PUT",
            body: {
              message: `chore: create CODEOWNERS for ${form.term_en}`,
              content: utf8ToBase64(newLine + "\n"),
              branch: branchName,
            },
          }, token);
        }
      }

      // 5. Create PR
      const prTitle = isNewTerm
        ? `feat: Add term "${form.term_cs}" (${form.term_en})`
        : isNewDef
        ? `feat: Add ${form.context} definition to "${editing.termData.term}"`
        : `fix: Update ${form.context} definition of "${editing.termData.term}"`;

      const prBody = isNewTerm
        ? `Adds new glossary term: **${form.term_cs}** / ${form.term_en}\n\nCreated via Glossary UI by @${login}`
        : `Updates definition for **${editing.termData.term}** in context \`${form.context}\`\n\nCreated via Glossary UI by @${login}`;

      const pr = await githubApi(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`,
        {
          method: "POST",
          body: { title: prTitle, body: prBody, head: branchName, base: "main" },
        },
        token
      );

      setEditing(null);
      setToast({
        title: isNewTerm ? "Term created!" : isNewDef ? "Definition added!" : "Definition updated!",
        prUrl: pr.html_url,
      });
      setTimeout(() => setToast(null), 30000);
    } catch (err) {
      setToast({ title: "Error creating PR", subtitle: err.message, error: true });
      setTimeout(() => setToast(null), 10000);
    } finally {
      setSaving(false);
    }
  }, [token, editing]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* ─── Header ────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Notino Glossary
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Multi-context company dictionary &middot; YAML per term &middot; CODEOWNERS &middot; PR workflow
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <LanguageSwitcher lang={lang} setLang={setLang} />
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => { setView("term"); setSelCtx(null); }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    view === "term" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  By term
                </button>
                <button
                  onClick={() => setView("context")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    view === "context" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  By area
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search in ${LANGUAGES[lang]?.full || "any language"}...`}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
              <svg
                className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={onlyMulti}
                onChange={(e) => setOnlyMulti(e.target.checked)}
                className="rounded"
              />
              Multi-context only
            </label>
            <button
              onClick={handleNewTerm}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New term
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main ──────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <StatsBar terms={filtered} />

        {view === "term" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setSelCtx(null)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  !selCtx ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                All
              </button>
              {Object.entries(CONTEXTS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setSelCtx(selCtx === k ? null : k)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    selCtx === k ? "text-white" : "bg-white border-gray-200"
                  }`}
                  style={
                    selCtx === k
                      ? { backgroundColor: v.color, borderColor: v.color }
                      : { color: v.color }
                  }
                >
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {filtered.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-lg">No results</p>
                  <p className="text-sm mt-1">Try different search or filters</p>
                </div>
              )}
              {filtered.map((item) => (
                <TermCard key={item.slug || item.term} item={item} lang={lang} onEdit={handleEdit} />
              ))}
            </div>
          </div>
        )}

        {view === "context" && (
          <div className="space-y-8">
            {Object.entries(CONTEXTS).map(([key, ctx]) => {
              let items = grouped[key] || [];
              if (search.trim()) {
                const q = search.toLowerCase();
                items = items.filter(
                  (t) =>
                    Object.values(t.translations).some((v) => v && v.toLowerCase().includes(q)) ||
                    t.definitions.some((d) => d.meaning.toLowerCase().includes(q))
                );
              }
              if (!items.length) return null;
              return (
                <section key={key}>
                  <div
                    className="flex items-center gap-2 mb-3 pb-2 border-b-2"
                    style={{ borderColor: ctx.color + "40" }}
                  >
                    <span className="text-2xl">{ctx.icon}</span>
                    <h2 className="text-lg font-bold" style={{ color: ctx.color }}>
                      {ctx.label}
                    </h2>
                    <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 ml-1">
                      {items.length}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {items.map((t) => {
                      const dn = t.translations[lang] || t.term;
                      const isTr = lang !== "cs" && t.translations[lang];
                      const other = [
                        ...new Set(
                          TERMS.find((o) => o.term === t.term)?.definitions.map((d) => d.context) || []
                        ),
                      ].filter((c) => c !== key);
                      return (
                        <div
                          key={t.term}
                          className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <span className="font-semibold text-gray-900">{dn}</span>
                            {isTr && (
                              <span className="text-sm text-gray-400 ml-1.5">({t.term})</span>
                            )}
                            {t.definitions[0]?.en && (
                              <code className="ml-2 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                {t.definitions[0].en}
                              </code>
                            )}
                            <p className="text-sm text-gray-600 mt-1">{t.definitions[0]?.meaning}</p>
                          </div>
                          {other.length > 0 && (
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <span className="text-xs text-amber-600 font-medium">Also in:</span>
                              {other.map((c) => (
                                <ContextBadge key={c} contextKey={c} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-center text-xs text-gray-400">
        <p>
          Notino Glossary &middot; Source: <code className="bg-gray-100 px-1 rounded">terms/*.yml</code> &middot; CODEOWNERS per term &middot; Edits create PRs
        </p>
      </footer>

      {editing && (
        <EditModal
          termData={editing.termData}
          definition={editing.definition}
          isNewTerm={editing.isNewTerm}
          saving={saving}
          onClose={() => !saving && setEditing(null)}
          onSave={handleSave}
        />
      )}
      <Toast data={toast} onClose={() => setToast(null)} />
    </div>
  );
}

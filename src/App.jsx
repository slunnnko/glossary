import { useState, useMemo, useCallback } from "react";
import data from "./terms.json";

import { githubApi, utf8ToBase64, base64ToUtf8 } from "./lib/github";
import { termToYAML, contextsToYAML } from "./lib/yaml";
import { slugify } from "./lib/utils";

import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { ContextBadge } from "./components/ContextBadge";
import { StatsBar } from "./components/StatsBar";
import { TermCard } from "./components/TermCard";
import { EditModal } from "./components/EditModal";
import { Toast } from "./components/Toast";

const { contexts: CONTEXTS, languages: LANGUAGES, terms: TERMS } = data;

const GITHUB_OWNER = "slunnnko";
const GITHUB_REPO = "glossary";

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("term");
  const [search, setSearch] = useState("");
  const [selCtx, setSelCtx] = useState(null);
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [lang, setLang] = useState("en");
  const [editing, setEditing] = useState(null); // { termData, isNewTerm }
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const token = import.meta.env.VITE_GITHUB_TOKEN || "";

  // ─── Filtered + sorted term list ─────────────────────────
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
        .map((t) => ({ ...t, definitions: t.definitions.filter((d) => d.context === selCtx) }))
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

  // ─── Grouped by context (for "By area" view) ─────────────
  const grouped = useMemo(() => {
    const g = {};
    Object.keys(CONTEXTS).forEach((c) => {
      g[c] = TERMS.filter((t) => t.definitions.some((d) => d.context === c))
        .map((t) => ({ ...t, definitions: t.definitions.filter((d) => d.context === c) }))
        .sort((a, b) =>
          (a.translations[lang] || a.term).localeCompare(b.translations[lang] || b.term)
        );
    });
    return g;
  }, [lang]);

  // ─── Edit handlers ────────────────────────────────────────
  const handleEdit = useCallback((termData) => {
    setEditing({ termData, isNewTerm: false });
  }, []);

  const handleNewTerm = useCallback(() => {
    setEditing({
      termData: { slug: "", term: "", translations: {}, definitions: [] },
      isNewTerm: true,
    });
  }, []);

  // onSave(translations, defs, isNewTerm, newContexts)
  const handleSave = useCallback(
    async (translations, defs, isNewTerm, newContexts = {}) => {
      if (!token) {
        setToast({ title: "Not configured", subtitle: "VITE_GITHUB_TOKEN secret is not set.", error: true });
        setTimeout(() => setToast(null), 8000);
        return;
      }

      setSaving(true);
      try {
        const user = await githubApi("/user", {}, token);
        const login = user.login;

        const refData = await githubApi(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/main`,
          {},
          token
        );
        const mainSha = refData.object.sha;

        const termSlug = isNewTerm ? slugify(translations.en) : editing.termData.slug;
        const branchName = `glossary/${termSlug}-${Date.now()}`;
        await githubApi(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`,
          { method: "POST", body: { ref: `refs/heads/${branchName}`, sha: mainSha } },
          token
        );

        // Commit term YAML
        const updatedTermData = {
          translations,
          definitions: defs.map((d) => ({
            context: d.context,
            meaning: d.meaning,
            ...(d.en_gui ? { en: d.en_gui } : {}),
            ...(d.en_code ? { enCode: d.en_code } : {}),
            ...(d.obsolete ? { obsolete: d.obsolete.split(";").filter(Boolean) } : {}),
          })),
        };

        const filePath = `terms/${termSlug}.yml`;
        let existingFileSha;
        if (!isNewTerm) {
          const fileData = await githubApi(
            `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=main`,
            {},
            token
          );
          existingFileSha = fileData.sha;
        }

        const commitMsg = isNewTerm
          ? `feat: add term "${translations.cs}" (${translations.en})`
          : `fix: update definitions of "${editing.termData.term}"`;

        await githubApi(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
          {
            method: "PUT",
            body: {
              message: commitMsg,
              content: utf8ToBase64(termToYAML(updatedTermData)),
              branch: branchName,
              ...(existingFileSha ? { sha: existingFileSha } : {}),
            },
          },
          token
        );

        // Commit CODEOWNERS for new terms
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
                message: `chore: add CODEOWNERS entry for ${translations.en}`,
                content: utf8ToBase64(updated),
                sha: coData.sha,
                branch: branchName,
              },
            }, token);
          } catch {
            await githubApi(`/${coPath}`, {
              method: "PUT",
              body: {
                message: `chore: create CODEOWNERS for ${translations.en}`,
                content: utf8ToBase64(newLine + "\n"),
                branch: branchName,
              },
            }, token);
          }
        }

        // Commit contexts.yml if new contexts were created
        if (Object.keys(newContexts).length > 0) {
          const ctxApiPath = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/contexts.yml`;
          try {
            const ctxData = await githubApi(`${ctxApiPath}?ref=main`, {}, token);
            const current = base64ToUtf8(ctxData.content);
            const addition = contextsToYAML(newContexts);
            const updated = current.trimEnd() + "\n\n" + addition;
            await githubApi(ctxApiPath, {
              method: "PUT",
              body: {
                message: `feat: add context(s) ${Object.keys(newContexts).join(", ")}`,
                content: utf8ToBase64(updated),
                sha: ctxData.sha,
                branch: branchName,
              },
            }, token);
          } catch {
            // contexts.yml doesn't exist yet — create it with all contexts
            const full = contextsToYAML({ ...CONTEXTS, ...newContexts });
            await githubApi(ctxApiPath, {
              method: "PUT",
              body: {
                message: `feat: create contexts.yml with context(s) ${Object.keys(newContexts).join(", ")}`,
                content: utf8ToBase64(full),
                branch: branchName,
              },
            }, token);
          }
        }

        // Open PR
        const prTitle = isNewTerm
          ? `feat: Add term "${translations.cs}" (${translations.en})`
          : `fix: Update definitions of "${editing.termData.term}"`;

        const prBody = isNewTerm
          ? `Adds new glossary term: **${translations.cs}** / ${translations.en}\n\nCreated via Glossary UI by @${login}`
          : `Updates definitions for **${editing.termData.term}** (${defs.map((d) => d.context).join(", ")})\n\nCreated via Glossary UI by @${login}`;

        const pr = await githubApi(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`,
          { method: "POST", body: { title: prTitle, body: prBody, head: branchName, base: "main" } },
          token
        );

        setEditing(null);
        setToast({ title: isNewTerm ? "Term created!" : "Definitions updated!", prUrl: pr.html_url });
        setTimeout(() => setToast(null), 30000);
      } catch (err) {
        setToast({ title: "Error creating PR", subtitle: err.message, error: true });
        setTimeout(() => setToast(null), 10000);
      } finally {
        setSaving(false);
      }
    },
    [token, editing]
  );

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Notino Glossary</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Multi-context company dictionary · YAML per term · CODEOWNERS · PR workflow
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
              <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      <main className="max-w-5xl mx-auto px-4 py-6">
        <StatsBar terms={filtered} />

        {view === "term" && (
          <div>
            {/* Context filter pills */}
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
                  style={selCtx === k ? { backgroundColor: v.color, borderColor: v.color } : { color: v.color }}
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
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2" style={{ borderColor: ctx.color + "40" }}>
                    <span className="text-2xl">{ctx.icon}</span>
                    <h2 className="text-lg font-bold" style={{ color: ctx.color }}>{ctx.label}</h2>
                    <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 ml-1">
                      {items.length}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {items.map((t) => {
                      const dn = t.translations[lang] || t.term;
                      const isTr = lang !== "cs" && t.translations[lang];
                      const other = [
                        ...new Set(TERMS.find((o) => o.term === t.term)?.definitions.map((d) => d.context) || []),
                      ].filter((c) => c !== key);
                      return (
                        <div key={t.term} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-start justify-between gap-3">
                          <div>
                            <span className="font-semibold text-gray-900">{dn}</span>
                            {isTr && <span className="text-sm text-gray-400 ml-1.5">({t.term})</span>}
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
                              {other.map((c) => <ContextBadge key={c} contextKey={c} />)}
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
          Notino Glossary · Source: <code className="bg-gray-100 px-1 rounded">terms/*.yml</code> · CODEOWNERS per term · Edits create PRs
        </p>
      </footer>

      {editing && (
        <EditModal
          termData={editing.termData}
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

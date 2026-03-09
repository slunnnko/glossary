import { useState } from "react";
import data from "../../terms.json";
import { slugify } from "../../lib/utils";
import { DefRow } from "./DefRow";
import { NewContextForm } from "./NewContextForm";

const { contexts: CONTEXTS, languages: LANGUAGES } = data;

const FLAGS = {
  cs: "\u{1F1E8}\u{1F1FF}",
  en: "\u{1F1EC}\u{1F1E7}",
  ro: "\u{1F1F7}\u{1F1F4}",
  it: "\u{1F1EE}\u{1F1F9}",
  ua: "\u{1F1FA}\u{1F1E6}",
  pl: "\u{1F1F5}\u{1F1F1}",
};

export function EditModal({ termData, isNewTerm, saving, onClose, onSave }) {
  const [translations, setTranslations] = useState(() =>
    Object.fromEntries(Object.keys(LANGUAGES).map((k) => [k, termData.translations[k] || ""]))
  );

  const [defs, setDefs] = useState(() =>
    isNewTerm
      ? [{ context: "", meaning: "", en_gui: "", en_code: "", obsolete: "" }]
      : termData.definitions.map((d) => ({
          context: d.context,
          meaning: d.meaning,
          en_gui: d.en || "",
          en_code: d.enCode || "",
          obsolete: (d.obsolete || []).join(";"),
        }))
  );

  const [newContexts, setNewContexts] = useState({});
  const [showNewCtxForm, setShowNewCtxForm] = useState(false);

  const allContexts = { ...CONTEXTS, ...newContexts };

  const updateDef = (i, k, v) =>
    setDefs((prev) =>
      prev.map((d, idx) => {
        if (idx !== i) return d;
        // Changing context resets content so you always start fresh for a new context
        if (k === "context") return { context: v, meaning: "", en_gui: "", en_code: "", obsolete: "" };
        return { ...d, [k]: v };
      })
    );

  const removeDef = (i) => setDefs((prev) => prev.filter((_, idx) => idx !== i));

  const addDef = () =>
    setDefs((prev) => [...prev, { context: "", meaning: "", en_gui: "", en_code: "", obsolete: "" }]);

  const copyDef = (i, targetCtx) =>
    setDefs((prev) => [...prev, { ...prev[i], context: targetCtx }]);

  const addNewContext = (key, ctx) => {
    setNewContexts((prev) => ({ ...prev, [key]: ctx }));
    setShowNewCtxForm(false);
  };

  const usedContexts = defs.map((d) => d.context).filter(Boolean);
  const unusedContexts = Object.keys(allContexts).filter((k) => !usedContexts.includes(k));
  const allDefsValid = defs.length > 0 && defs.every((d) => d.context && d.meaning);
  const canSave =
    !saving && allDefsValid && (isNewTerm ? translations.cs && translations.en : true);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-gray-900">
              {isNewTerm ? "Add new term" : `Edit: ${termData.translations.cs || termData.term}`}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {isNewTerm
                ? "Creates a new YAML file + adds you to CODEOWNERS"
                : `terms/${termData.slug}.yml`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-4 space-y-5 flex-1">
          {/* Translations */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Translations
            </p>
            {isNewTerm ? (
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(LANGUAGES).map(([lk, lv]) => (
                  <label key={lk} className="block">
                    <span className="text-xs font-medium text-gray-500">
                      {FLAGS[lk]} {lv.full}
                      {(lk === "cs" || lk === "en") && <span className="text-red-500"> *</span>}
                    </span>
                    <input
                      type="text"
                      value={translations[lk]}
                      onChange={(e) => setTranslations((p) => ({ ...p, [lk]: e.target.value }))}
                      className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(translations).map(([lk, lv]) =>
                  lv ? (
                    <span
                      key={lk}
                      className="text-xs px-2 py-1 rounded-lg border bg-gray-50 text-gray-600 border-gray-200"
                    >
                      <span className="font-bold opacity-40">{LANGUAGES[lk]?.label}:</span> {lv}
                    </span>
                  ) : null
                )}
              </div>
            )}
            {isNewTerm && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                File: <code className="font-mono">terms/{slugify(translations.en || "...")}.yml</code>
              </p>
            )}
          </div>

          {/* Definitions */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Definitions
            </p>
            <div className="space-y-3">
              {defs.map((def, i) => (
                <DefRow
                  key={i}
                  def={def}
                  total={defs.length}
                  usedContexts={usedContexts}
                  allContexts={allContexts}
                  onChange={(k, v) => updateDef(i, k, v)}
                  onRemove={() => removeDef(i)}
                  onCopy={(ctx) => copyDef(i, ctx)}
                />
              ))}
            </div>

            {/* Add another context row */}
            {unusedContexts.length > 0 && (
              <button
                type="button"
                onClick={addDef}
                className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-dashed border-gray-200 hover:border-blue-300 transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another context
              </button>
            )}

            {/* Create entirely new context */}
            {showNewCtxForm ? (
              <NewContextForm
                allContexts={allContexts}
                onAdd={addNewContext}
                onCancel={() => setShowNewCtxForm(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowNewCtxForm(true)}
                className="mt-2 w-full py-2 text-xs text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl border border-dashed border-gray-200 hover:border-purple-300 transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                Create new context…
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
              />
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
              onClick={() => onSave(translations, defs, isNewTerm, newContexts)}
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
                  {isNewTerm ? "Create Term & PR" : "Save & Create PR"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

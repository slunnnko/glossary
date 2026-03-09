import { useState } from "react";
import data from "../terms.json";
import { ContextBadge } from "./ContextBadge";
import { ObsoleteBadges } from "./ObsoleteBadges";

const { languages: LANGUAGES } = data;

export function TermCard({ item, lang, onEdit }) {
  const [open, setOpen] = useState(false);
  const ctxs = [...new Set(item.definitions.map((d) => d.context))];
  const display = item.translations[lang] || item.term;
  const showOrig = lang !== "cs" && item.translations[lang];
  const n = item.definitions.length;

  // Group definitions with identical content so shared defs show once with multiple badges
  const groupedDefs = (() => {
    const groups = [];
    for (const def of item.definitions) {
      const key = `${def.meaning}|${def.en || ""}|${def.enCode || ""}|${(def.obsolete || []).join(";")}`;
      const g = groups.find((x) => x.key === key);
      if (g) g.contexts.push(def.context);
      else groups.push({ key, def, contexts: [def.context] });
    }
    return groups;
  })();

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Header row */}
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
          <code className="text-xs text-gray-300 font-mono hidden sm:block">{item.slug}.yml</code>
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
        <div className="border-t border-gray-100">
          {/* Translation strip */}
          <div className="px-5 pt-3 pb-2 flex flex-wrap gap-1.5 border-b border-gray-50">
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
                  <span className="font-bold opacity-40">{LANGUAGES[lk]?.label}:</span> {lv}
                </span>
              ) : null
            )}
          </div>

          {/* Definitions grouped by identical content */}
          <div className="px-5 pt-3 pb-2 divide-y divide-gray-50">
            {groupedDefs.map((group, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2.5">
                <div className="shrink-0 pt-px flex flex-wrap gap-1">
                  {group.contexts.map((c) => (
                    <ContextBadge key={c} contextKey={c} size="sm" />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 text-sm leading-relaxed">{group.def.meaning}</p>
                  {(group.def.en || group.def.enCode) && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {group.def.en && (
                        <code className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                          EN: {group.def.en}
                        </code>
                      )}
                      {group.def.enCode && (
                        <code className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 font-mono">
                          {group.def.enCode}
                        </code>
                      )}
                    </div>
                  )}
                  <ObsoleteBadges items={group.def.obsolete} />
                </div>
              </div>
            ))}
          </div>

          {/* Edit button */}
          <div className="px-5 pb-4">
            <button
              onClick={() => onEdit(item)}
              className="w-full py-2 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-gray-200 hover:border-blue-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit term / manage contexts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

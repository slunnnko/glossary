import { useState } from "react";
import { ContextBadge } from "../ContextBadge";

export function DefRow({ def, total, usedContexts, allContexts, onChange, onRemove, onCopy }) {
  const [copyOpen, setCopyOpen] = useState(false);
  const available = Object.keys(allContexts).filter((k) => !usedContexts.includes(k));

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-4 space-y-3">
      {/* Context selector + actions */}
      <div className="flex items-end gap-2">
        <label className="flex-1 block">
          <span className="text-xs font-medium text-gray-500">
            Context <span className="text-red-500">*</span>
          </span>
          <select
            value={def.context}
            onChange={(e) => onChange("context", e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- select --</option>
            {Object.entries(allContexts).map(([k, v]) => (
              <option
                key={k}
                value={k}
                disabled={usedContexts.includes(k) && k !== def.context}
              >
                {v.icon} {v.label}
              </option>
            ))}
          </select>
        </label>

        {/* Copy to... */}
        {available.length > 0 && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setCopyOpen((o) => !o)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy to…
            </button>
            {copyOpen && (
              <div className="absolute top-full mt-1 right-0 bg-white rounded-xl shadow-lg border border-gray-200 p-2 flex flex-wrap gap-1 z-20 min-w-max">
                {available.map((ctx) => (
                  <button
                    key={ctx}
                    type="button"
                    onClick={() => {
                      onCopy(ctx);
                      setCopyOpen(false);
                    }}
                    className="hover:scale-105 transition-transform"
                  >
                    <ContextBadge contextKey={ctx} ctxMap={allContexts} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Remove */}
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {/* Meaning */}
      <label className="block">
        <span className="text-xs font-medium text-gray-500">
          Definition (Czech) <span className="text-red-500">*</span>
        </span>
        <textarea
          rows={2}
          value={def.meaning}
          onChange={(e) => onChange("meaning", e.target.value)}
          className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </label>

      {/* EN fields */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">EN (GUI label)</span>
          <input
            type="text"
            value={def.en_gui}
            onChange={(e) => onChange("en_gui", e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">EN (code name)</span>
          <input
            type="text"
            value={def.en_code}
            onChange={(e) => onChange("en_code", e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </label>
      </div>

      {/* Obsolete */}
      <label className="block">
        <span className="text-xs font-medium text-gray-500">
          Obsolete code names (semicolon-separated)
        </span>
        <input
          type="text"
          value={def.obsolete}
          onChange={(e) => onChange("obsolete", e.target.value)}
          className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
      </label>
    </div>
  );
}

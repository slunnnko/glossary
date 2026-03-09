import { useState } from "react";
import { slugify } from "../../lib/utils";

export function NewContextForm({ allContexts, onAdd, onCancel }) {
  const [form, setForm] = useState({ key: "", label: "", icon: "🏷️", color: "#6b7280" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const keyExists = !!allContexts[form.key];
  const canAdd = form.key && form.label && !keyExists;

  return (
    <div className="mt-2 rounded-xl border border-dashed border-purple-300 bg-purple-50/30 p-4 space-y-3">
      <p className="text-xs font-semibold text-purple-700">New context</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">
            Key (slug) <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={form.key}
            placeholder="e.g. warehouse"
            onChange={(e) => set("key", slugify(e.target.value))}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">
            Label <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={form.label}
            placeholder="e.g. Warehouse"
            onChange={(e) => set("label", e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Icon (emoji)</span>
          <input
            type="text"
            value={form.icon}
            onChange={(e) => set("icon", e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Color</span>
          <div className="mt-1 flex gap-2 items-center">
            <input
              type="color"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              className="h-8 w-10 rounded border border-gray-200 cursor-pointer"
            />
            <code className="text-xs text-gray-400">{form.color}</code>
          </div>
        </label>
      </div>
      {keyExists && (
        <p className="text-xs text-red-500">Key &quot;{form.key}&quot; already exists.</p>
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => onAdd(form.key, { label: form.label, icon: form.icon, color: form.color })}
          className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add context
        </button>
      </div>
    </div>
  );
}

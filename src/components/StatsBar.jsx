export function StatsBar({ terms }) {
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

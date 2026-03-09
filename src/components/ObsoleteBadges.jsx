export function ObsoleteBadges({ items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
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

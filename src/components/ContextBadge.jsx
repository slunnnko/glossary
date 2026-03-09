import data from "../terms.json";

const { contexts: CONTEXTS } = data;

export function ContextBadge({ contextKey, size = "sm", ctxMap = CONTEXTS }) {
  const ctx = ctxMap[contextKey];
  if (!ctx) return null;
  const cls = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${cls}`}
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

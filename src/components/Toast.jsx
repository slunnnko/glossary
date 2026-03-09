export function Toast({ data, onClose }) {
  if (!data) return null;
  const bg = data.error ? "bg-red-600" : "bg-green-600";
  return (
    <div
      className={`fixed bottom-4 right-4 ${bg} text-white rounded-xl shadow-2xl px-5 py-3 flex items-start gap-3 z-50 max-w-md`}
    >
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
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 shrink-0">
        ×
      </button>
    </div>
  );
}

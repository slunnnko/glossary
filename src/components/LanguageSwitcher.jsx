import data from "../terms.json";

const { languages: LANGUAGES } = data;

const FLAGS = {
  cs: "\u{1F1E8}\u{1F1FF}",
  en: "\u{1F1EC}\u{1F1E7}",
  ro: "\u{1F1F7}\u{1F1F4}",
  it: "\u{1F1EE}\u{1F1F9}",
  ua: "\u{1F1FA}\u{1F1E6}",
  pl: "\u{1F1F5}\u{1F1F1}",
};

export function LanguageSwitcher({ lang, setLang }) {
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
          {FLAGS[k] || l.label}
        </button>
      ))}
    </div>
  );
}

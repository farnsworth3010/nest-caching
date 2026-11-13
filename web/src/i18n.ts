import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export type Lang = 'en' | 'ru';

// Russian has more plural forms: each English `x_other` key needs `x_one`, `x_few`, `x_many` and `x_other` in Russian.
type RuKey<K> = K extends `${infer Base}_other` ? `${Base}_one` | `${Base}_few` | `${Base}_many` | K : K;

// The Russian bundle must have exactly the English keys (plus the extra plural forms), so a missing key fails typecheck.
export type Ru<T> = { [K in keyof T as RuKey<K>]: T[K] extends string ? string : T[K] extends unknown[] ? T[K] : Ru<T[K]> };

function storedLang(): Lang | undefined {
  try {
    const lang = localStorage.getItem('lang');

    return lang === 'en' || lang === 'ru' ? lang : undefined;
  } catch {
    return undefined;
  }
}

i18n.on('languageChanged', (lang) => {
  document.documentElement.lang = lang;
});

i18n.use(initReactI18next).init({
  lng: storedLang() ?? (navigator.language.startsWith('ru') ? 'ru' : 'en'),
  fallbackLng: 'en',
  resources: {},
  interpolation: { escapeValue: false },
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (_langs, ns, key) => console.warn(`i18n: missing key ${ns}:${key}`),
});

// Each page registers its own namespace from its i18n.ts, so pages never edit a shared file.
export function addNs<T extends object>(ns: string, en: T, ru: Ru<T>) {
  i18n.addResourceBundle('en', ns, en);
  i18n.addResourceBundle('ru', ns, ru);
}

// Only an explicit choice is stored, so the browser language keeps deciding until the user picks one.
export function setLang(lang: Lang) {
  i18n.changeLanguage(lang);

  try {
    localStorage.setItem('lang', lang);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page load only.
  }
}

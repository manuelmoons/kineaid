import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import nl from './nl.json';
import en from './en.json';

export const LANGUAGES = ['nl', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { nl: { translation: nl }, en: { translation: en } },
    supportedLngs: LANGUAGES,
    nonExplicitSupportedLngs: true, // nl-BE → nl
    fallbackLng: 'nl',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'kineaid.lang', caches: ['localStorage'] },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;

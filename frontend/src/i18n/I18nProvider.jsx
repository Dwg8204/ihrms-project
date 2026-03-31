import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { localeByLanguage, translations } from "./translations";

const I18nContext = createContext(null);

function getNestedValue(source, key) {
  return key.split(".").reduce((acc, part) => acc?.[part], source);
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem("ihrms_language");
    return translations[saved] ? saved : "vietnamese";
  });

  useEffect(() => {
    localStorage.setItem("ihrms_language", language);
    document.documentElement.lang =
      language === "japanese" ? "ja" : language === "english" ? "en" : "vi";
  }, [language]);

  const value = useMemo(() => {
    const setLanguage = (nextLanguage) => {
      setLanguageState(translations[nextLanguage] ? nextLanguage : "vietnamese");
    };

    const t = (key) =>
      getNestedValue(translations[language], key) ??
      getNestedValue(translations.english, key) ??
      key;

    return {
      language,
      setLanguage,
      t,
      locale: localeByLanguage[language] || "vi-VN",
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
}

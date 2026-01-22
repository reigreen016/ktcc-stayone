import { createContext, useContext, useState, type ReactNode } from "react";

export type Language = "ja" | "en";

export type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}

type LanguageProviderProps = {
  children: ReactNode;
};

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [lang, setLang] = useState<Language>(() => {
    const stored = localStorage.getItem("lang");
    return stored === "en" ? "en" : "ja";
  });

  const handleSetLang = (nextLang: Language) => {
    localStorage.setItem("lang", nextLang);
    setLang(nextLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

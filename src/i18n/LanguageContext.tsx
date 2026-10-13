import React, { createContext, useContext } from 'react';
import { SupportedLanguage, translations, Translations } from './translations';

interface LanguageContextType {
  language: SupportedLanguage;
  t: Translations;
  setLanguage: (lang: SupportedLanguage) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const language: SupportedLanguage = 'en';

  const setLanguage = (_lang: SupportedLanguage) => {
    // UI is English only as per design requirements
  };

  const t = translations.en;

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

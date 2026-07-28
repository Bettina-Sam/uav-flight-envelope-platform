import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'en' | 'hi' | 'ta';

const LABELS: Record<AppLanguage, Record<string, string>> = {
  en: {},
  hi: {
    Home: 'होम', Design: 'डिज़ाइन', Analysis: 'विश्लेषण', Tools: 'उपकरण',
    'UAV Input': 'यूएवी इनपुट', Physics: 'भौतिकी', 'ML Prediction': 'एमएल पूर्वानुमान',
    'Envelope Dashboard': 'फ्लाइट एनवेलप डैशबोर्ड', 'Command Center': 'मिशन कंट्रोल',
    'Physics vs ML': 'भौतिकी बनाम एमएल', 'Performance (Range / Endurance)': 'प्रदर्शन (रेंज / एंड्यूरेंस)',
    'Uncertainty Quantification': 'अनिश्चितता विश्लेषण', 'Feature Importance': 'फीचर महत्व',
    Sensitivity: 'संवेदनशीलता', 'Mission Planner': 'मिशन प्लानर',
    'Global Mission Map': 'वैश्विक मिशन मानचित्र', 'Design Studio (Auto Design / Failure Sim)': 'डिज़ाइन स्टूडियो',
    'Batch CSV': 'बैच CSV', Report: 'रिपोर्ट', About: 'परिचय', English: 'English',
    Hindi: 'हिन्दी', Tamil: 'தமிழ்', Language: 'भाषा',
  },
  ta: {
    Home: 'முகப்பு', Design: 'வடிவமைப்பு', Analysis: 'பகுப்பாய்வு', Tools: 'கருவிகள்',
    'UAV Input': 'UAV உள்ளீடு', Physics: 'இயற்பியல்', 'ML Prediction': 'ML கணிப்பு',
    'Envelope Dashboard': 'பறப்பு டாஷ்போர்டு', 'Command Center': 'மிஷன் கட்டுப்பாடு',
    'Physics vs ML': 'இயற்பியல் vs ML', 'Performance (Range / Endurance)': 'செயல்திறன் (தூரம் / தாங்கும் நேரம்)',
    'Uncertainty Quantification': 'நிச்சயமின்மை பகுப்பாய்வு', 'Feature Importance': 'அம்ச முக்கியத்துவம்',
    Sensitivity: 'உணர்திறன்', 'Mission Planner': 'மிஷன் திட்டமிடல்',
    'Global Mission Map': 'உலக மிஷன் வரைபடம்', 'Design Studio (Auto Design / Failure Sim)': 'வடிவமைப்பு அரங்கம்',
    'Batch CSV': 'தொகுதி CSV', Report: 'அறிக்கை', About: 'பற்றி', English: 'English',
    Hindi: 'हिन्दी', Tamil: 'தமிழ்', Language: 'மொழி',
  },
};

interface LanguageValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (text: string) => string;
  speechCode: string;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('uav-language');
    return saved === 'hi' || saved === 'ta' ? saved : 'en';
  });
  useEffect(() => {
    localStorage.setItem('uav-language', language);
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (text: string) => LABELS[language][text] || text,
    speechCode: language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-US',
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}


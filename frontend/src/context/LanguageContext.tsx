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

const GLOBAL_TERMS: Record<Exclude<AppLanguage, 'en'>, Record<string, string>> = {
  hi: {
    'Flight Envelope Dashboard': 'फ्लाइट एनवेलप डैशबोर्ड', 'Mission Control Snapshot': 'मिशन कंट्रोल स्नैपशॉट',
    '3D Mission Performance': '3D मिशन प्रदर्शन', 'Feature Importance & Model Comparison': 'फीचर महत्व और मॉडल तुलना',
    'Physics vs ML — Full Comparison': 'भौतिकी बनाम ML — पूर्ण तुलना', 'Altitude Profile Along Route': 'मार्ग का ऊंचाई प्रोफ़ाइल',
    'Global Mission Map': 'वैश्विक मिशन मानचित्र', 'Uncertainty Quantification': 'अनिश्चितता विश्लेषण',
    'Mission Planner': 'मिशन प्लानर', 'Machine Learning Prediction': 'मशीन लर्निंग पूर्वानुमान',
    'Physics Calculator': 'भौतिकी कैलकुलेटर', 'Performance Analysis': 'प्रदर्शन विश्लेषण',
    'About & Formula Reference': 'परिचय और सूत्र संदर्भ', 'Export Report': 'रिपोर्ट निर्यात करें',
    'UAV Configuration': 'UAV विन्यास', 'Current Configuration Snapshot': 'वर्तमान विन्यास सारांश',
    'Model Comparison': 'मॉडल तुलना', 'Global Feature Importance': 'वैश्विक फीचर महत्व',
    'Native Feature Importance': 'मूल फीचर महत्व', 'Explain Page': 'पृष्ठ समझाएँ',
    'Live Tuning': 'लाइव समायोजन', 'Ghost Comparison': 'सहेजे विन्यास की तुलना',
    'Range Reference': 'रेंज संदर्भ', 'Design Score': 'डिज़ाइन स्कोर',
    'Mission Duration': 'मिशन अवधि', 'Total Distance': 'कुल दूरी', 'Safe travel height': 'सुरक्षित यात्रा ऊंचाई',
    'Terrain elevation': 'भू-भाग ऊंचाई', 'Min safe altitude': 'न्यूनतम सुरक्षित ऊंचाई',
    'Mission Warnings': 'मिशन चेतावनियाँ', 'Live Weather': 'लाइव मौसम', 'Per-Leg Breakdown': 'प्रत्येक चरण का विवरण',
    'Recommended Altitude': 'अनुशंसित ऊंचाई', 'Rate of Climb': 'चढ़ाई दर', 'Power Required': 'आवश्यक शक्ति',
    Endurance: 'सहनकाल', Range: 'रेंज', Physics: 'भौतिकी', 'ML Prediction': 'ML पूर्वानुमान',
    Analysis: 'विश्लेषण', Design: 'डिज़ाइन', Tools: 'उपकरण', Input: 'इनपुट', Output: 'आउटपुट',
    Safety: 'सुरक्षा', Status: 'स्थिति', Safe: 'सुरक्षित', Warning: 'चेतावनी', Warnings: 'चेतावनियाँ',
    Mission: 'मिशन', Aircraft: 'विमान', Fuel: 'ईंधन', Battery: 'बैटरी', Mass: 'द्रव्यमान',
    Payload: 'पेलोड', Speed: 'गति', Cruise: 'क्रूज़', Distance: 'दूरी', Duration: 'अवधि',
    Comparison: 'तुलना', Uncertainty: 'अनिश्चितता', Sensitivity: 'संवेदनशीलता',
    Report: 'रिपोर्ट', About: 'परिचय', Results: 'परिणाम', Prediction: 'पूर्वानुमान',
    Calculate: 'गणना करें', Compute: 'गणना करें', Run: 'चलाएँ', Reset: 'रीसेट',
    Download: 'डाउनलोड', Save: 'सहेजें', Delete: 'हटाएँ', Loading: 'लोड हो रहा है',
    Parameter: 'पैरामीटर', Value: 'मान', Mean: 'औसत', Confidence: 'विश्वसनीयता',
    Language: 'भाषा', English: 'अंग्रेज़ी', Hindi: 'हिन्दी', Tamil: 'तमिल',
  },
  ta: {
    'Flight Envelope Dashboard': 'பறப்பு என்வலப் டாஷ்போர்டு', 'Mission Control Snapshot': 'மிஷன் கட்டுப்பாட்டு சுருக்கம்',
    '3D Mission Performance': '3D மிஷன் செயல்திறன்', 'Feature Importance & Model Comparison': 'அம்ச முக்கியத்துவம் மற்றும் மாதிரி ஒப்பீடு',
    'Physics vs ML — Full Comparison': 'இயற்பியல் vs ML — முழு ஒப்பீடு', 'Altitude Profile Along Route': 'பாதை உயரச் சுயவிவரம்',
    'Global Mission Map': 'உலக மிஷன் வரைபடம்', 'Uncertainty Quantification': 'நிச்சயமின்மை பகுப்பாய்வு',
    'Mission Planner': 'மிஷன் திட்டமிடல்', 'Machine Learning Prediction': 'இயந்திரக் கற்றல் கணிப்பு',
    'Physics Calculator': 'இயற்பியல் கணிப்பான்', 'Performance Analysis': 'செயல்திறன் பகுப்பாய்வு',
    'About & Formula Reference': 'அறிமுகம் மற்றும் சூத்திரக் குறிப்பு', 'Export Report': 'அறிக்கையை ஏற்றுமதி செய்',
    'UAV Configuration': 'UAV அமைப்பு', 'Current Configuration Snapshot': 'தற்போதைய அமைப்பு சுருக்கம்',
    'Model Comparison': 'மாதிரி ஒப்பீடு', 'Global Feature Importance': 'உலகளாவிய அம்ச முக்கியத்துவம்',
    'Native Feature Importance': 'மூல அம்ச முக்கியத்துவம்', 'Explain Page': 'பக்கத்தை விளக்கு',
    'Live Tuning': 'நேரடி சரிசெய்தல்', 'Ghost Comparison': 'சேமித்த அமைப்பு ஒப்பீடு',
    'Range Reference': 'தூரக் குறிப்பு', 'Design Score': 'வடிவமைப்பு மதிப்பெண்',
    'Mission Duration': 'மிஷன் காலம்', 'Total Distance': 'மொத்த தூரம்', 'Safe travel height': 'பாதுகாப்பான பயண உயரம்',
    'Terrain elevation': 'நிலப்பரப்பு உயரம்', 'Min safe altitude': 'குறைந்தபட்ச பாதுகாப்பு உயரம்',
    'Mission Warnings': 'மிஷன் எச்சரிக்கைகள்', 'Live Weather': 'நேரடி வானிலை', 'Per-Leg Breakdown': 'ஒவ்வொரு கட்ட விவரம்',
    'Recommended Altitude': 'பரிந்துரைக்கப்பட்ட உயரம்', 'Rate of Climb': 'ஏற்ற விகிதம்', 'Power Required': 'தேவையான சக்தி',
    Endurance: 'தாங்கும் நேரம்', Range: 'தூரம்', Physics: 'இயற்பியல்', 'ML Prediction': 'ML கணிப்பு',
    Analysis: 'பகுப்பாய்வு', Design: 'வடிவமைப்பு', Tools: 'கருவிகள்', Input: 'உள்ளீடு', Output: 'வெளியீடு',
    Safety: 'பாதுகாப்பு', Status: 'நிலை', Safe: 'பாதுகாப்பானது', Warning: 'எச்சரிக்கை', Warnings: 'எச்சரிக்கைகள்',
    Mission: 'மிஷன்', Aircraft: 'விமானம்', Fuel: 'எரிபொருள்', Battery: 'மின்கலம்', Mass: 'நிறை',
    Payload: 'சுமை', Speed: 'வேகம்', Cruise: 'க்ரூஸ்', Distance: 'தூரம்', Duration: 'காலம்',
    Comparison: 'ஒப்பீடு', Uncertainty: 'நிச்சயமின்மை', Sensitivity: 'உணர்திறன்',
    Report: 'அறிக்கை', About: 'பற்றி', Results: 'முடிவுகள்', Prediction: 'கணிப்பு',
    Calculate: 'கணக்கிடு', Compute: 'கணக்கிடு', Run: 'இயக்கு', Reset: 'மீட்டமை',
    Download: 'பதிவிறக்கு', Save: 'சேமி', Delete: 'நீக்கு', Loading: 'ஏற்றப்படுகிறது',
    Parameter: 'அளவுரு', Value: 'மதிப்பு', Mean: 'சராசரி', Confidence: 'நம்பிக்கை',
    Language: 'மொழி', English: 'ஆங்கிலம்', Hindi: 'இந்தி', Tamil: 'தமிழ்',
  },
};

function translateVisibleText(text: string, language: AppLanguage) {
  if (language === 'en' || !text.trim()) return text;
  let translated = text;
  const entries = Object.entries(GLOBAL_TERMS[language]).sort((a, b) => b[0].length - a[0].length);
  for (const [source, target] of entries) {
    translated = translated.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), target);
  }
  return translated;
}

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
  useEffect(() => {
    const originals = new WeakMap<Text, string>();
    const lastRendered = new WeakMap<Text, string>();
    const translatedNodes = new Set<Text>();
    let applying = false;
    const apply = (root: Node) => {
      const nodes: Text[] = [];
      if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text);
      else {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      }
      applying = true;
      for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION'].includes(parent.tagName) || parent.closest('svg')) continue;
        if (!originals.has(node)) originals.set(node, node.nodeValue || '');
        const original = originals.get(node) || '';
        const next = translateVisibleText(original, language);
        if (node.nodeValue !== next) node.nodeValue = next;
        lastRendered.set(node, next);
        translatedNodes.add(node);
      }
      applying = false;
    };
    apply(document.body);
    const observer = new MutationObserver((records) => {
      if (applying) return;
      for (const record of records) {
        if (record.type === 'characterData') {
          const node = record.target as Text;
          if (node.nodeValue === lastRendered.get(node)) continue;
          originals.set(node, node.nodeValue || '');
          apply(node);
        } else record.addedNodes.forEach(apply);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      applying = true;
      translatedNodes.forEach((node) => {
        const original = originals.get(node);
        if (original != null && node.isConnected) node.nodeValue = original;
      });
      applying = false;
    };
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

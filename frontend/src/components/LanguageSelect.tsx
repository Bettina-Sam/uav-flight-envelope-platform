import { Languages } from 'lucide-react';
import { AppLanguage, useLanguage } from '../context/LanguageContext';

export default function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label className="inline-flex items-center gap-1.5 text-muted" title={t('Language')}>
      <Languages className="w-4 h-4" />
      <select
        aria-label={t('Language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as AppLanguage)}
        className="bg-bg border border-border rounded-md px-1.5 py-1.5 font-mono text-[10px] text-text"
      >
        <option value="en">{t('English')}</option>
        <option value="hi">{t('Hindi')}</option>
        <option value="ta">{t('Tamil')}</option>
        <option value="kn">ಕನ್ನಡ</option>
      </select>
    </label>
  );
}

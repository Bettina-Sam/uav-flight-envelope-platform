import { useLocation } from 'react-router-dom';
import NarrateButton from './NarrateButton';
import { PAGE_DESCRIPTIONS } from '../lib/narrationText';
import { useLanguage } from '../context/LanguageContext';

/** Sits in the navbar. Looks up a plain-English description of whatever
 * page you're currently on and offers to read it aloud — the "explain
 * this page" voice assistant. Falls back to a generic line for any route
 * not in PAGE_DESCRIPTIONS (e.g. /about, /sensitivity) rather than
 * disappearing, so it's always available. */
export default function PageNarrator() {
  const { pathname } = useLocation();
  const { language, t } = useLanguage();
  const descriptions = PAGE_DESCRIPTIONS[language === 'kn' ? 'en' : language];
  const text = descriptions[pathname] || descriptions.default;
  return <NarrateButton text={text} label={t('Explain Page')} />;
}

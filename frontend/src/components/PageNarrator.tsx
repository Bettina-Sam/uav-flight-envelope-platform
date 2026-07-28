import { useLocation } from 'react-router-dom';
import NarrateButton from './NarrateButton';
import { PAGE_DESCRIPTIONS } from '../lib/narrationText';

/** Sits in the navbar. Looks up a plain-English description of whatever
 * page you're currently on and offers to read it aloud — the "explain
 * this page" voice assistant. Falls back to a generic line for any route
 * not in PAGE_DESCRIPTIONS (e.g. /about, /sensitivity) rather than
 * disappearing, so it's always available. */
export default function PageNarrator() {
  const { pathname } = useLocation();
  const text = PAGE_DESCRIPTIONS[pathname]
    || 'This page is part of the UAV Flight Envelope Platform, a physics-informed machine learning system for UAV design analysis.';
  return <NarrateButton text={text} label="Explain Page" />;
}

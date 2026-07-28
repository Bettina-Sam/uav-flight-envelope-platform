import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Radar, ChevronDown } from 'lucide-react';
import InstallButton from './InstallButton';
import ThemeToggle from './ThemeToggle';
import SoundToggle from './SoundToggle';
import PageNarrator from './PageNarrator';

interface LinkItem { to: string; label: string }
interface GroupItem { key: string; label: string; links: LinkItem[] }

const STANDALONE_LEFT: LinkItem = { to: '/', label: 'Home' };

const GROUPS: GroupItem[] = [
  {
    key: 'design',
    label: 'Design',
    links: [
      { to: '/input', label: 'UAV Input' },
      { to: '/physics', label: 'Physics' },
      { to: '/ml', label: 'ML Prediction' },
    ],
  },
  {
    key: 'analysis',
    label: 'Analysis',
    links: [
      { to: '/dashboard', label: 'Envelope Dashboard' },
      { to: '/command-center', label: 'Command Center' },
      { to: '/comparison', label: 'Physics vs ML' },
      { to: '/performance', label: 'Performance (Altitude / Range / Endurance)' },
      { to: '/uncertainty', label: 'Uncertainty Quantification' },
      { to: '/feature-importance', label: 'Feature Importance' },
      { to: '/sensitivity', label: 'Sensitivity' },
    ],
  },
  {
    key: 'tools',
    label: 'Tools',
    links: [
      { to: '/mission', label: 'Mission Planner' },
      { to: '/missions', label: 'Global Mission Map' },
      { to: '/design-studio', label: 'Design Studio (Auto Design / Failure Sim)' },
      { to: '/batch', label: 'Batch CSV' },
    ],
  },
];

const STANDALONE_RIGHT: LinkItem[] = [
  { to: '/report', label: 'Report' },
  { to: '/about', label: 'About' },
];

function useIsGroupActive(links: LinkItem[]) {
  const { pathname } = useLocation();
  return links.some((l) => pathname === l.to || pathname.startsWith(l.to + '/'));
}

function DesktopDropdown({ group }: { group: GroupItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = useIsGroupActive(group.links);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1 px-3 py-2 rounded-md transition-colors ${
          isActive ? 'text-cyan bg-cyan/10' : 'text-muted hover:text-text'
        }`}
      >
        {group.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 min-w-[260px] rounded-lg border border-border bg-bg shadow-xl py-1.5 z-50"
          >
            {group.links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive: linkActive }) =>
                  `block px-4 py-2.5 text-[11px] normal-case tracking-normal font-sans transition-colors ${
                    linkActive ? 'text-cyan bg-cyan/10' : 'text-muted hover:text-text hover:bg-border/30'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileGroup({ group, onNavigate }: { group: GroupItem; onNavigate: () => void }) {
  const isActive = useIsGroupActive(group.links);
  const [expanded, setExpanded] = useState(isActive);

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`w-full flex items-center justify-between px-3 py-3 ${isActive ? 'text-cyan' : 'text-text'}`}
      >
        <span>{group.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {group.links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={onNavigate}
                className={({ isActive: linkActive }) =>
                  `block pl-6 pr-3 py-2.5 text-[11px] normal-case tracking-normal font-sans ${
                    linkActive ? 'text-cyan bg-cyan/10' : 'text-muted'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <NavLink to="/" className="flex items-center gap-2 shrink-0" onClick={() => setOpen(false)}>
          <Radar className="w-5 h-5 text-cyan" />
          <span className="font-display font-semibold tracking-tight text-[15px]">
            UAV<span className="text-cyan"> Envelope</span>
          </span>
        </NavLink>

        <nav className="hidden lg:flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
          <NavLink
            to={STANDALONE_LEFT.to}
            end
            className={({ isActive }) => `px-3 py-2 rounded-md transition-colors ${isActive ? 'text-cyan bg-cyan/10' : 'text-muted hover:text-text'}`}
          >
            {STANDALONE_LEFT.label}
          </NavLink>
          {GROUPS.map((g) => <DesktopDropdown key={g.key} group={g} />)}
          {STANDALONE_RIGHT.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `px-3 py-2 rounded-md transition-colors ${isActive ? 'text-cyan bg-cyan/10' : 'text-muted hover:text-text'}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <PageNarrator />
          <SoundToggle />
          <ThemeToggle />
          <InstallButton compact />
        </div>

        <button className="lg:hidden text-text shrink-0" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-border bg-bg font-mono text-xs uppercase tracking-wider overflow-hidden"
          >
            <NavLink
              to={STANDALONE_LEFT.to}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) => `block px-3 py-3 border-b border-border/60 ${isActive ? 'text-cyan bg-cyan/10' : 'text-text'}`}
            >
              {STANDALONE_LEFT.label}
            </NavLink>
            {GROUPS.map((g) => <MobileGroup key={g.key} group={g} onNavigate={() => setOpen(false)} />)}
            {STANDALONE_RIGHT.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `block px-3 py-3 border-b border-border/60 last:border-b-0 ${isActive ? 'text-cyan bg-cyan/10' : 'text-text'}`}
              >
                {l.label}
              </NavLink>
            ))}
            <div className="px-3 py-3 flex items-center gap-2 flex-wrap"><PageNarrator /><SoundToggle /><ThemeToggle /><InstallButton compact /></div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

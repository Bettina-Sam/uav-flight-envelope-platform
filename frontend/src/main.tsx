import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Vite's dependency pre-bundler can invalidate an in-flight lazy-loaded
// chunk (e.g. the first time you open a route that pulls in a heavy
// dependency) whenever it discovers a new dependency mid-session — this
// shows up as "Failed to fetch dynamically imported module" / "504
// Outdated Optimize Dep" in the console. This is a known Vite dev-server
// race, not an app bug. `vite:preloadError` is Vite's own event for the
// production-equivalent case: a stale tab still open after a new deploy,
// referencing chunk hashes that no longer exist. The documented fix is to
// reload once when it fires. We only do that while the tab is actually
// visible — reloading a backgrounded tab (browsers throttle/delay its
// requests, which can spuriously look like this same failure) would
// silently wipe in-memory app state for no good reason. Combined with
// UAVContext's session-storage persistence, even a genuine reload here
// won't lose your current UAV input/results.
window.addEventListener('vite:preloadError', () => {
  if (document.visibilityState === 'visible') {
    window.location.reload()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

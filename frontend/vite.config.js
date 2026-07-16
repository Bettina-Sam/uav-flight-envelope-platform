import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
// vite-plugin-pwa auto-injects its own <link rel="manifest" href="/manifest.webmanifest">
// tag whenever devOptions.enabled is true, even when `manifest: false` is set (a quirk in
// this plugin version) - and in dev mode that path isn't reliably served, causing a
// "Syntax error" in the console (the request falls through to index.html). Rather than
// fight the plugin further, this tiny middleware makes that exact URL resolve correctly
// by serving our own static manifest.json content for it, so BOTH manifest link tags on
// the page end up valid regardless of which one the browser picks.
function serveManifestWebmanifestInDev() {
    return {
        name: 'serve-manifest-webmanifest',
        apply: 'serve',
        configureServer: function (server) {
            server.middlewares.use(function (req, res, next) {
                if (req.url === '/manifest.webmanifest') {
                    var manifestPath = path.resolve(__dirname, 'public/manifest.json');
                    res.setHeader('Content-Type', 'application/manifest+json');
                    res.end(fs.readFileSync(manifestPath, 'utf-8'));
                    return;
                }
                next();
            });
        },
    };
}
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        serveManifestWebmanifestInDev(),
        VitePWA({
            registerType: 'autoUpdate',
            // We manage the web app manifest ourselves (public/manifest.json + a manual
            // <link rel="manifest"> tag in index.html) rather than letting the plugin
            // generate + auto-inject its own manifest.webmanifest. The plugin injects its
            // own <link> tag unconditionally whenever `manifest` is set (even in dev mode,
            // where that generated manifest doesn't reliably resolve), which produced a
            // second, broken manifest link alongside ours. `manifest: false` disables that
            // generation/injection entirely; service worker precaching (below) is unaffected.
            manifest: false,
            devOptions: {
                enabled: true,
                type: 'module',
            },
            includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'offline.html', 'manifest.json'],
            workbox: {
                navigateFallback: '/offline.html',
                // Explicit allowlist so every in-app route (not just requests Workbox
                // guesses are "navigations") gets the offline fallback, and so the
                // dev-mode console doesn't log a false-alarm "route not in allowlist"
                // notice when navigating directly to a deep route like /physics.
                navigateFallbackAllowlist: [/^(?!\/__).*/],
                runtimeCaching: [
                    {
                        urlPattern: function (_a) {
                            var url = _a.url;
                            return url.pathname.startsWith('/predict') || url.pathname.startsWith('/api');
                        },
                        handler: 'NetworkFirst',
                        options: { cacheName: 'api-cache', networkTimeoutSeconds: 5 }
                    }
                ]
            }
        })
    ],
    server: {
        port: 5173
    },
    build: {
        rollupOptions: {
            output: {
                // Split heavy, rarely-changing vendor libraries into their own
                // cacheable chunks instead of bundling everything into one ~900KB
                // main chunk. This doesn't reduce total bytes on a cold load, but
                // it means an app-code-only update (which is most updates) doesn't
                // invalidate the browser's cache of these vendor chunks, and the
                // main app chunk itself parses faster since it's smaller.
                manualChunks: {
                    'vendor-charts': ['recharts'],
                    'vendor-motion': ['framer-motion'],
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                },
            },
        },
    },
    optimizeDeps: {
        // Pre-bundle these eagerly at dev-server startup instead of discovering
        // them lazily on first import. Without this, the FIRST page load that
        // hits the 3D scene can trigger a mid-request dependency re-optimization
        // (visible as a "504 Outdated Optimize Dep" console error), which can
        // cause that one dynamic import to fail. A page refresh alone usually
        // clears it, but this avoids the race entirely.
        include: ['framer-motion', 'leaflet', 'react-leaflet'],
    }
});

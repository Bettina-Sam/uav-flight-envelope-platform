# Deployment Guide

Two independent deployments: **backend** (FastAPI + ML models) to Render/Railway/HF
Spaces, and **frontend** (static PWA build) to Vercel/Netlify.

---

## 1. Backend deployment

### Option A — Render (recommended, generous free tier for demos)

1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Web Service**, connect the repo, set
   **Root Directory** to `backend`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Important:** the pre-trained model artifacts in `backend/models/` and the dataset
   in `backend/data/` must be committed to the repo (they're small — a few MB) so the
   deployed instance has them at startup, since there's no separate training step in
   this deploy path. Alternatively, add a build step
   `python -m app.dataset_generator && python -m app.train_model` before start, but
   this adds a few minutes to every deploy.
6. After deploy, note your backend URL, e.g. `https://uav-envelope-api.onrender.com`.

**Common error:** "Application failed to respond" on first request — Render free tier
spins down idle services; the first request after idle takes 30-60s to cold-start. This
is expected on the free tier, not a bug.

### Option B — Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
2. Set root directory to `backend` in service settings.
3. Railway auto-detects Python; set the start command explicitly:
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add the `PORT` environment variable if not auto-injected (Railway usually injects it).

### Option C — Hugging Face Spaces (Docker SDK)

1. Create a new Space, SDK = **Docker**.
2. Add a `Dockerfile` in `backend/`:
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   COPY . .
   EXPOSE 7860
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
   ```
   (HF Spaces expects port 7860 by convention.)
3. Push to the Space's git remote; it builds and deploys automatically.

### CORS setup (required for all options)

By default `backend/app/main.py` allows all origins (`allow_origins=["*"]`) for ease of
local development. **Before final deployment**, tighten this to your actual frontend
URL:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 2. Frontend deployment

### Option A — Vercel

1. [vercel.com](https://vercel.com) → New Project → import the repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite (auto-detected).
4. Build command: `npm run build` — Output directory: `dist` (both auto-detected).
5. **Environment variable:** add `VITE_API_URL` = your deployed backend URL from step 1
   (e.g. `https://uav-envelope-api.onrender.com`).
6. Deploy. Vercel gives you a URL like `https://uav-envelope.vercel.app`.

### Option B — Netlify

1. [netlify.com](https://netlify.com) → Add new site → Import from Git.
2. Base directory: `frontend`. Build command: `npm run build`. Publish directory:
   `frontend/dist`.
3. Site settings → Environment variables → add `VITE_API_URL` as above.
4. Deploy.

### Production build & environment variables

`VITE_API_URL` is read at **build time** (Vite bakes it into the JS bundle), not at
runtime — so it must be set in the hosting platform's environment variable settings
*before* the build runs, not just in a local `.env` file (which is for local dev only
and is gitignored).

### Testing the deployment

1. Open the deployed frontend URL.
2. Go to **UAV Input**, submit the default values.
3. If you see a "Prediction failed" error, open browser dev tools → Network tab, check
   the failed request's status:
   - **CORS error** → backend `allow_origins` doesn't include your frontend URL, fix
     and redeploy backend.
   - **404 / connection refused** → `VITE_API_URL` is wrong or backend isn't running,
     check the value in your hosting platform's env var settings and redeploy frontend.
   - **500 error** → check backend logs (Render/Railway dashboard) — likely a missing
     model artifact, see `docs/INSTALLATION.md` common errors.
4. Confirm the **Install App** button appears (Chrome/Edge) — this only works over
   HTTPS, so it should now show reliably on the deployed URL, unlike local `npm run dev`.

---

## 3. Common deployment errors

| Symptom | Cause | Fix |
|---|---|---|
| CORS error in browser console | Backend origin allowlist doesn't include frontend URL | Update `allow_origins` in `main.py`, redeploy backend |
| Frontend builds but API calls 404 | `VITE_API_URL` unset or wrong at build time | Set env var in hosting platform, trigger a fresh build |
| Backend 500 on `/predict` | Model artifacts missing from deployed instance | Ensure `backend/models/*.joblib` and `backend/data/*.csv` are committed to the repo, or add a training step to the build |
| Backend cold-start timeout | Free-tier services spin down when idle | Expected behavior on free tiers; first request after idle is slow |
| PWA install button never appears | Site not served over HTTPS, or manifest/service worker not built | Confirm deployed URL is HTTPS (all listed hosts provide this by default) and that `npm run build` completed (check for `dist/sw.js`) |

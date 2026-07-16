# Installation Guide

This guide assumes a fresh machine with Python 3.10+ and Node.js 18+ installed.

Check versions first:
```bash
python3 --version     # should be 3.10 or newer
node --version         # should be 18 or newer
npm --version
```

---

## 1. Backend setup

```bash
cd backend
```

### 1.1 Create and activate a virtual environment

macOS / Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

Windows (PowerShell):
```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

You should see `(venv)` at the start of your terminal prompt once activated.

### 1.2 Install dependencies

```bash
pip install -r requirements.txt
```

**Expected output:** pip downloads and installs fastapi, uvicorn, numpy, pandas,
scikit-learn, xgboost, reportlab, etc. Takes 1-3 minutes depending on connection.

**Common error:** `xgboost` failing to install on very old pip — fix with
`pip install --upgrade pip` first, then retry.

### 1.3 (Optional) Regenerate the dataset

The zip already includes a pre-generated dataset at `data/uav_synthetic_dataset.csv`
and pre-trained models in `models/`. Skip to step 1.5 unless you want to change the
sampling bounds in `app/dataset_generator.py::BOUNDS` or regenerate with a different
sample size.

```bash
python -m app.dataset_generator --n 6000 --seed 42
```

**Expected output:**
```
[dataset_generator] wrote 6000 rows to backend/data/uav_synthetic_dataset.csv
```

### 1.4 (Optional) Retrain the ML models

```bash
python -m app.train_model
```

**Expected output:** per-model R²/MAE/RMSE printed for LinearRegression, RandomForest,
ExtraTrees, GradientBoosting, SVR, XGBoost, GaussianProcess, then:
```
[train_model] BEST MODEL: XGBoost (R2=0.98xx)
[train_model] Safety classifier accuracy: 0.96xx
[train_model] Saved best_model.joblib, scaler.joblib, safety_classifier.joblib, ...
```
Training takes roughly 2-3 minutes on a typical laptop (SVR and GaussianProcess are the
slowest steps).

**Common error:** `FileNotFoundError: data/uav_synthetic_dataset.csv` — you skipped step
1.3; run the dataset generator first.

### 1.5 Run the API server

```bash
uvicorn app.main:app --reload --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### 1.6 Test the API

Open http://localhost:8000/docs in a browser — this is FastAPI's interactive Swagger
UI. Try the `/predict` endpoint with the example payload shown, or from a terminal:

```bash
curl http://localhost:8000/
# {"status":"ok","service":"uav-flight-envelope-api","model_loaded":true,"best_model":"XGBoost"}
```

**Common error:** `RuntimeError: ML model artifacts not found` — you deleted or never
generated `models/*.joblib`; run steps 1.3 and 1.4.

---

## 2. Frontend setup

Open a **new terminal** (keep the backend running in the first one).

```bash
cd frontend
```

### 2.1 Install packages

```bash
npm install
```

**Expected output:** `added 5xx packages` after 30-90 seconds. Some deprecation
warnings from transitive dependencies are normal and safe to ignore.

### 2.2 Configure the API URL

```bash
cp .env.example .env
```

Edit `.env` if your backend is not on `http://localhost:8000`:
```
VITE_API_URL=http://localhost:8000
```

### 2.3 Run the development server

```bash
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Open http://localhost:5173 in your browser. Go to **UAV Input**, submit the default
values, and confirm you land on the **Flight Envelope Dashboard** with populated gauges
and charts — this confirms frontend ↔ backend connectivity.

**Common error:** blank dashboard / network error toast — check that the backend is
still running on the port in `.env`, and that no firewall is blocking `localhost:8000`.

### 2.4 Build the production bundle

```bash
npm run build
```

**Expected output:**
```
✓ built in x.xxs
PWA v0.20.5
mode      generateSW
files generated
  dist/sw.js
  dist/workbox-xxxxxxx.js
```

This produces `frontend/dist/` — a static, installable PWA bundle. Preview it locally
with:
```bash
npm run preview
```

### 2.5 Test the PWA install button

1. Run `npm run preview` (production build only — the install prompt does not fire
   reliably in `npm run dev`).
2. Open http://localhost:4173 in Chrome or Edge.
3. Look for the **Install App** button in the top-right of the navbar, or the install
   icon in the browser's address bar.
4. Click it, confirm the install dialog — the app should open as a standalone window
   with its own icon, no browser chrome.

On mobile (after deploying, see `docs/DEPLOYMENT.md`): open the deployed URL in Chrome
(Android) or Safari (iOS, use Share → Add to Home Screen), and the same install flow
applies.

---

## 3. Common errors summary

| Error | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'app'` | Running uvicorn from the wrong directory | `cd backend` first, then `uvicorn app.main:app` |
| `RuntimeError: ML model artifacts not found` | Models not trained yet | Run `python -m app.dataset_generator` then `python -m app.train_model` |
| CORS error in browser console | Backend `allow_origins` too strict after deployment | Update `backend/app/main.py` CORS config, see `docs/DEPLOYMENT.md` |
| Frontend shows "Prediction failed. Is the backend running?" | Backend not running or wrong `VITE_API_URL` | Check backend terminal for errors; verify `.env` |
| `npm install` fails on native module build | Missing build tools (rare, mostly Windows) | Install "Desktop development with C++" (Windows) or Xcode CLT (macOS) |

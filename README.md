# UAV Flight Envelope Prediction & Altitude Optimization Platform

A physics-informed machine learning platform that predicts the feasible flight envelope
and recommended cruise altitude of a **twin-engine, fixed-wing, propeller-driven electric
UAV** — built for a DRDO internship prototype.

> **Status:** research prototype. Trained on synthetic (physics-generated) data, not real
> flight-test telemetry — but built with a real-data pipeline already in place (see
> "Using real flight-test data" below) so it can be retrained the moment real data exists.
> See `docs/ML_METHODOLOGY.md` for full disclosure of assumptions and limitations.

## What's new in this revision

- **Twin-engine airframe.** The baseline aircraft now has 2 engines (configurable 1–4).
  A dedicated **Engine-Out Safety Analysis** evaluates whether the aircraft can still
  hold its minimum altitude with one engine inoperative — the standard multi-engine
  contingency check.
- **Real-data-ready pipeline.** `backend/app/data_loader.py` + `--data-source` flag on
  `train_model.py` let you switch from synthetic → real → blended data with zero code
  changes elsewhere. See "Using real flight-test data" below.
- **Light mode by default**, with a persistent dark-mode toggle in the navbar.
- **3D flight visualization** on the dashboard — an orbit-controllable 3D scene showing
  the twin-engine aircraft positioned at its recommended altitude within the swept
  operating column (built with three.js / react-three-fiber).
- **Richer PDF report** — branded header/footer, page numbers, aircraft configuration
  summary, engine-out section, and an embedded physics-vs-ML comparison chart.
- **More robust install button** — includes manual "Add to Home Screen" instructions on
  iOS Safari, which never fires the standard install-prompt event.

## What it predicts

| # | Output | Source |
|---|---|---|
| 1 | Minimum operating altitude | Physics + ML |
| 2 | Maximum operating altitude | Physics + ML |
| 3 | Recommended altitude (engineering-optimized, **not** a simple average) | Physics + ML |
| 4 | Mean altitude (midpoint of min/max, shown separately for reference) | Physics + ML |
| 5 | Service ceiling / Absolute ceiling | Physics + ML |
| 6 | Rate of climb | Physics + ML |
| 7 | Range / Endurance | Physics + ML |
| 8 | Power required / available | Physics + ML |
| 9 | Lift / Drag / L-over-D | Physics + ML |
| 10 | Safety status (SAFE / CAUTION / CRITICAL) | Physics (rule-based) + ML (classifier) |
| 11 | **Engine-out contingency** (single-engine-inoperative ceiling & climb) | Physics only |

## Architecture

```
uav-platform/
├── backend/          FastAPI + physics engine + ML pipeline
│   ├── app/
│   │   ├── physics.py           equations + twin-engine + engine-out analysis
│   │   ├── dataset_generator.py synthetic dataset generation
│   │   ├── data_loader.py       synthetic / real / blended data source abstraction
│   │   ├── train_model.py       ML training, comparison, explainability
│   │   ├── schemas.py           Pydantic request/response models
│   │   ├── report_generator.py  PDF / CSV report builder
│   │   └── main.py              FastAPI app & endpoints
│   ├── data/                    generated dataset + real-data template CSV
│   ├── models/                  trained model artifacts (.joblib) + manifest
│   ├── notebooks/                exploratory notebooks (optional)
│   └── requirements.txt
├── frontend/          React + TypeScript + Tailwind + Vite + PWA
│   └── src/
│       ├── pages/                the 10 required pages
│       ├── components/           gauges, charts, 3D scene, engine-out panel, install/theme buttons
│       ├── context/               shared UAV input/result state + theme state
│       └── api/                   backend client
└── docs/               full documentation set (this folder's sibling)
```

## Quick start

See `docs/INSTALLATION.md` for full step-by-step setup. Short version:

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.dataset_generator      # generates data/uav_synthetic_dataset.csv
python -m app.train_model            # trains models, saves to models/
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env                 # set VITE_API_URL if backend isn't on localhost:8000
npm run dev                          # http://localhost:5173
```

The `data/` and `models/` folders already ship with a pre-generated dataset and a
pre-trained model in this zip, so the backend will work immediately with
`pip install -r requirements.txt` and `uvicorn app.main:app --reload` — regenerating the
dataset/model is only needed if you want to change the sampling bounds or retrain.

## Using real flight-test data (when it becomes available)

1. Copy `backend/data/real_uav_flight_data_template.csv` to
   `backend/data/real_uav_flight_data.csv`.
2. Fill it with real logged rows — same columns as the synthetic dataset (design
   parameters as features, measured performance as targets). See
   `docs/DATASET_DESCRIPTION.md` for the exact schema.
3. Retrain with the new source:
   ```bash
   python -m app.train_model --data-source real       # real data only
   python -m app.train_model --data-source blended     # synthetic + real combined
   ```
   No other code changes are needed — the FastAPI backend and frontend are unaffected.

## Documentation index

- `docs/INSTALLATION.md` — full setup instructions (backend + frontend + PWA)
- `docs/USER_MANUAL.md` — how to use each of the 10 pages
- `docs/ML_METHODOLOGY.md` — dataset generation, model comparison, metrics, limitations
- `docs/DATASET_DESCRIPTION.md` — every column, its bounds, and why (incl. real-data schema)
- `docs/FORMULA_SHEET.md` — every aerospace equation used, including engine-out analysis
- `docs/DEPLOYMENT.md` — deploying frontend (Vercel/Netlify) + backend (Render/Railway/HF Spaces)
- `docs/PROJECT_REPORT_STRUCTURE.md` — suggested structure for your written report
- `docs/PPT_STRUCTURE.md` — suggested slide-by-slide structure for your presentation
- `docs/DEMO_SCRIPT.md` — a script for live-demoing this to your guide
- `docs/VIVA_QA.md` — anticipated viva questions and model answers

## Key engineering decision: recommended altitude ≠ average

The recommended altitude is deliberately **not** `(min + max) / 2`. It is selected by
scoring every feasible altitude on a weighted combination of aerodynamic efficiency,
climb-rate safety margin, power margin, and an endurance proxy — see
`backend/app/physics.py::_select_recommended_altitude` and `docs/FORMULA_SHEET.md` for
the full reasoning. The simple midpoint is still computed and shown separately, labelled
"mean altitude", purely for reference.


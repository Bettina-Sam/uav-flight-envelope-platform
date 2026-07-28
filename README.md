# UAV Range and Endurance Analysis Platform

A physics-informed machine-learning platform focused exclusively on two UAV mission outputs:

- **Endurance** — how long the aircraft can remain airborne.
- **Range value** — the project-defined direct product of cruise speed in m/s and endurance in hours.

The application compares a transparent physics calculation with a trained ML surrogate and
provides uncertainty, sensitivity, optimization, and batch-analysis workflows for these outputs.

## Current product scope

The user interface and primary prediction API intentionally exclude flight-envelope, ceiling,
climb-rate, and cruise-level outputs. The remaining application routes are:

| Route | Purpose |
|---|---|
| `/input` | Aircraft, aerodynamic, propulsion, fuel, and battery inputs |
| `/physics` | Physics range and endurance |
| `/ml` | ML range and endurance |
| `/comparison` | Physics-versus-ML comparison |
| `/performance` | Range and endurance deep dives |
| `/uncertainty` | Aleatoric and epistemic uncertainty |
| `/batch` | CSV batch prediction |

Retired routes redirect to the range/endurance performance page.

## Endurance models

### Fuel-powered configuration

Fuel mode is active when both fuel capacity and SFC are greater than zero. It uses the
Breguet endurance relationship:

\[
E =
\frac{1}{SFC \cdot g}
\left(\frac{L}{D}\right)
\ln\left(\frac{m_i}{m_f}\right)
\]

Fuel density is assumed to be `0.8 kg/L`, with a 20% reserve.

### Electric configuration

When fuel mode is inactive:

\[
E =
\frac{\text{usable battery energy}}
{\text{required electrical power}}
\]

The battery calculation also retains a 20% reserve.

### Display format

Endurance is displayed as `HH:MM`. For example, `0.57` decimal hours is approximately
`00:34`, while `15.75` decimal hours is `15:45`.

## Range convention

The project currently uses the requested direct convention:

```text
range value = cruise speed (m/s) × endurance (decimal hours)
```

Example:

```text
45 × 15.75 = 708.75
```

This is a project-specific range value, not a dimensionally converted distance in kilometres.

## Quick start

### Backend — Windows PowerShell

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Backend — macOS/Linux

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend runs at `http://localhost:5173` and expects the backend at
`http://localhost:8000` unless `VITE_API_URL` is configured.

## Validation

```bash
cd frontend
npm run build
```

```bash
cd backend
python -m compileall -q app
```

## Status

This is a research prototype trained primarily on synthetic physics-generated data. It is not
flight-certified and should be calibrated against measured engine, battery, and flight-test data
before operational use.

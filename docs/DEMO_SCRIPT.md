# Demo Script

A ~6-8 minute live-demo walkthrough for your guide.

**Before you start:** have the backend running (`uvicorn app.main:app --reload`) and
frontend running (`npm run dev`) or the deployed URLs open, in a clean browser window.

---

**1. Home page (30s)**
"This is a physics-informed ML platform for predicting UAV flight envelopes. It runs
two independent prediction paths — a transparent physics engine and a trained ML
model — and compares them, so we can audit the ML output against ground truth."

**2. UAV Input (45s)**
"I'll enter a representative 12 kg mini-UAV configuration." *(use the defaults or your
own numbers)* "Notice the derived values — aspect ratio, wing loading, power loading —
update live as I type." Click **Run Physics Engine & ML Prediction**.

**3. Physics Calculator (60s)**
"This is the physics engine's output — computed directly from ISA atmosphere and
aircraft-performance equations, no machine learning involved yet." Point at the
**recommended altitude** and its stated reason. "Note it's not the midpoint of min and
max — I'll show that comparison in a moment."

**4. ML Prediction (45s)**
"Same 14 input features, but now predicted by the trained XGBoost surrogate model in
milliseconds, with no physics simulation running at inference time." Point at the
confidence score.

**5. Flight Envelope Dashboard — the centerpiece (2 min)**
"This is the main dashboard." Point at the two gauges. "Green band is the safe
operating zone up to the service ceiling." Scroll to the rate-of-climb chart. "You can
see climb rate falling and power required rising with altitude — that's the physics
engine's full sweep." Scroll to the comparison bar chart. "Physics and ML side by
side — where they diverge most is recommended altitude, and I can explain why: it's an
argmax over a fairly flat scoring function, which is inherently harder for a regression
model to hit exactly than a smoothly varying quantity like lift or drag."

**6. Feature Importance (45s)**
"Which design parameters matter most for altitude prediction — both a model-agnostic
permutation importance and the model's own internal importance." Point out the model
comparison table. "XGBoost outperformed 6 other models we compared, including Random
Forest, SVR, and Gaussian Process."

**7. Sensitivity Analysis (45s)**
"A what-if tool — sweep one parameter, like motor power, and see how the flight
envelope responds while everything else stays fixed." Run one live sweep.

**8. Batch CSV / Report (30s, optional if time-constrained)**
"For comparing multiple design variants at once, or exporting a PDF summary for a
report appendix." Show the download template and one PDF export.

**9. About / Methodology (30s)**
"Full disclosure of what's implemented, what's a synthetic assumption, and what's
future work — I want to be upfront that this is a research prototype trained on
physics-generated data, not real flight-test telemetry."

**10. Install as an app (15s, if presenting from a deployed URL)**
Click **Install App** in the navbar. "It installs as a standalone PWA on desktop or
mobile."

---

**If asked "why not just average min and max for recommended altitude?"** — this is
the question you most want asked. Answer: "Because the physically meaningful altitude
depends on where climb-rate margin, aerodynamic efficiency, and power margin are all
still healthy — not the arithmetic middle of the operating range. I show the simple
mean altitude too, separately labeled, purely as a reference point."

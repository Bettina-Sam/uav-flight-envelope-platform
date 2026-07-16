# PPT Structure (suggested slide-by-slide outline)

Aim for 15-18 slides for a typical internship review presentation (~15-20 min talk).

1. **Title slide** — project title, your name, DRDO internship, guide's name
2. **Problem statement** — why predicting UAV flight envelope matters, one sentence
3. **Objectives** — bullet list of the 11 predicted outputs
4. **Why synthetic data** — one slide, 3 bullets (real data restricted, physics-informed
   surrogate is standard practice, limitations disclosed upfront)
5. **System architecture** — diagram: UAV parameters → Physics Engine + ML Model →
   Flight Envelope → Frontend Dashboard
6. **Physics engine** — 4-5 key equations (ISA density, lift/drag, rate of climb,
   service ceiling) with a one-line plain-English explanation each
7. **The recommended-altitude insight** — this is your strongest differentiator slide:
   show the composite scoring formula and explain why it beats a naive average, with a
   before/after example (min/max/mean vs. actual recommended altitude for one config)
8. **Dataset generation** — 6,000 synthetic configurations, bounds table (abbreviated),
   one-row-per-configuration design choice
9. **ML pipeline** — 7 models compared, table of R²/MAE, XGBoost wins
10. **Model comparison chart** — bar chart, R² by model (screenshot from Feature
    Importance page)
11. **Feature importance** — which parameters matter most for altitude (screenshot)
12. **Live demo transition slide** — "Live demonstration" (see `DEMO_SCRIPT.md`)
13. **Dashboard screenshot** — flight envelope gauge + comparison chart
14. **Safety classification** — rule-based system, 96% ML classifier accuracy
15. **PWA / deployment** — installable app, architecture (Vercel + Render), one
    screenshot of the install prompt
16. **Limitations** — honest, 3-4 bullets (synthetic data, no wind modeling, empirical
    prop curve, not certified)
17. **Future work** — SHAP, PDP, CatBoost, real-data validation
18. **Thank you / Questions**

**Presentation tips:**
- Lead with the recommended-altitude insight (slide 7) — it's the single strongest
  demonstration that this isn't "just averaging numbers."
- Keep equation slides visual (one equation, one plain-English line) rather than dense
  derivations — save derivations for the written report appendix.
- Have the live app open in a browser tab as backup in case the demo slide needs a
  live click-through instead of screenshots.

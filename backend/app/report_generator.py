"""
report_generator.py
--------------------
Generates a downloadable PDF engineering summary report and a CSV export
for a single UAV prediction (physics + ML results). Used by the
/report/pdf and /report/csv endpoints (Report Generation page).

The PDF includes: a branded cover header, aircraft configuration summary
(with twin-engine badge), physics engine results, ML surrogate results,
an embedded physics-vs-ML comparison chart, the engine-out safety
analysis, safety warnings, and page numbers with a consistent footer.
"""

import io
import csv
import base64
from datetime import datetime


from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                 Image, HRFlowable, KeepTogether)
from reportlab.lib.enums import TA_CENTER

BRAND_DARK = colors.HexColor("#0B1220")
BRAND_CYAN = colors.HexColor("#0D857C")
BRAND_AMBER = colors.HexColor("#B45F06")
BRAND_GREEN = colors.HexColor("#04825A")
BRAND_RED = colors.HexColor("#C81E1E")
LIGHT_BG = colors.HexColor("#F2F5F9")
GREY = colors.HexColor("#64748B")

STATUS_COLOR = {"SAFE": BRAND_GREEN, "CAUTION": BRAND_AMBER, "CRITICAL": BRAND_RED}


def _make_comparison_chart(comparison: list) -> io.BytesIO:
    """Renders the physics-vs-ML comparison as a grouped bar chart PNG for embedding."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    keys = [c["target"] for c in comparison if c["target"] not in ("lift_n", "drag_n")]
    physics_vals = [c["physics_value"] for c in comparison if c["target"] in keys]
    ml_vals = [c["ml_value"] for c in comparison if c["target"] in keys]
    labels = [k.replace("_", "\n") for k in keys]

    fig, ax = plt.subplots(figsize=(7.2, 3.2), dpi=170)
    x = range(len(labels))
    width = 0.38
    ax.bar([i - width / 2 for i in x], physics_vals, width, label="Physics", color="#0D857C")
    ax.bar([i + width / 2 for i in x], ml_vals, width, label="ML", color="#B45F06")
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=6.5)
    ax.tick_params(axis="y", labelsize=7)
    ax.legend(fontsize=8, frameon=False)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_title("Physics vs ML \u2014 Predicted Values by Target", fontsize=9, color="#101827")
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", transparent=True)
    plt.close(fig)
    buf.seek(0)
    return buf


def _header_footer(canvas, doc):
    canvas.saveState()
    # top brand bar
    canvas.setFillColor(BRAND_DARK)
    canvas.rect(0, doc.pagesize[1] - 12 * mm, doc.pagesize[0], 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(18 * mm, doc.pagesize[1] - 8 * mm, "UAV FLIGHT ENVELOPE PLATFORM")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(doc.pagesize[0] - 18 * mm, doc.pagesize[1] - 8 * mm,
                            "Physics-Informed ML \u00b7 Twin-Engine Fixed-Wing UAV")
    # footer
    canvas.setFillColor(GREY)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(18 * mm, 10 * mm,
                       f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} \u00b7 Research prototype \u2014 synthetic-data model, not certified for flight")
    canvas.drawRightString(doc.pagesize[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf_report(uav_input: dict, physics_result: dict, ml_result: dict, comparison: list,
                      local_explanation: dict = None, optimize_range: list = None,
                      optimize_endurance: list = None, failure_results: list = None,
                      design_score: dict = None, mission: dict = None,
                      flight_profile_image: str = None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=18 * mm,
                             leftMargin=18 * mm, rightMargin=18 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleX", parent=styles["Title"], fontSize=19, spaceAfter=2,
                                  textColor=BRAND_DARK)
    sub_style = ParagraphStyle("SubX", parent=styles["Normal"], fontSize=9.5, textColor=GREY)
    h2 = ParagraphStyle("H2X", parent=styles["Heading2"], fontSize=12.5, spaceBefore=16, spaceAfter=6,
                         textColor=BRAND_DARK)
    body = ParagraphStyle("BodyX", parent=styles["Normal"], fontSize=9.5, leading=13.5)
    small = ParagraphStyle("SmallX", parent=styles["Normal"], fontSize=8, textColor=GREY)

    status = physics_result.get("safety_status", "SAFE")
    status_color = STATUS_COLOR.get(status, BRAND_AMBER)
    n_engines = int(uav_input.get("num_engines", 1))

    elements = []

    # --- Cover ---
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("UAV Flight Envelope &amp; Mission Engineering Report", title_style))
    elements.append(Paragraph(
        "Physics-informed ML platform \u2014 physics engine, ML surrogate, explainability, "
        "sensitivity, mission planning, failure analysis, and design scoring, in one report.", sub_style))
    elements.append(Spacer(1, 8))
    status_table = Table(
        [[Paragraph(f"<b>SAFETY STATUS: {status}</b>", ParagraphStyle(
            "StatusX", fontSize=11, textColor=colors.white, alignment=TA_CENTER))]],
        colWidths=[174 * mm],
    )
    status_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), status_color),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(status_table)
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} \u00b7 "
        f"{'Twin-Engine' if n_engines == 2 else str(n_engines) + '-Engine'} fixed-wing electric UAV", small))

    # --- Executive summary ---
    elements.append(Paragraph("Executive Summary", h2))
    ld = physics_result.get("l_over_d", 0)
    summary_bits = [
        f"This {physics_result.get('mass_kg', uav_input.get('mass_kg'))} kg-class design carries "
        f"{uav_input.get('payload_kg')} kg of payload and is recommended to cruise at "
        f"{physics_result.get('recommended_altitude_m', 0):.0f} m, yielding an estimated "
        f"{physics_result.get('endurance_hr', 0):.2f} hr endurance and {physics_result.get('range_km', 0):.0f} km range "
        f"at an L/D of {ld:.1f}."
    ]
    if design_score:
        summary_bits.append(
            f"Overall design score: <b>{design_score['total']:.0f}/100 (Grade {design_score['grade']})</b>, "
            f"combining safety status, aerodynamic efficiency, power margin, and ML-model reliability."
        )
    if mission:
        summary_bits.append(
            f"A {len(mission.get('waypoints', []))}-waypoint mission was planned covering "
            f"{mission.get('total_distance_km', 0):.1f} km in {mission.get('mission_duration_hr', 0) * 60:.0f} min, "
            f"with a {mission.get('battery_margin_pct', 0):.0f}% battery margin."
        )
    elements.append(Paragraph(" ".join(summary_bits), body))

    # --- 1. Aircraft configuration ---
    elements.append(Paragraph("1. UAV Configuration", h2))
    engine_label = "Twin-Engine" if n_engines == 2 else ("Single-Engine" if n_engines == 1 else f"{n_engines}-Engine")
    elements.append(Paragraph(
        f"<b>{engine_label} fixed-wing electric UAV</b> \u00b7 Total mass {uav_input.get('mass_kg')} kg "
        f"\u00b7 Cruise speed {uav_input.get('cruise_speed_ms')} m/s \u00b7 "
        f"Total power {uav_input.get('motor_max_power_w', 0) * n_engines:.0f} W "
        f"({uav_input.get('motor_max_power_w')} W \u00d7 {n_engines} engine{'s' if n_engines != 1 else ''})",
        body))
    elements.append(Spacer(1, 6))
    input_rows = [["Parameter", "Value"]] + [[k.replace("_", " ").title(), f"{v}"] for k, v in uav_input.items()]
    t = Table(input_rows, colWidths=[85 * mm, 85 * mm])
    t.setStyle(_table_style())
    elements.append(t)

    # --- 2. Mission profile ---
    elements.append(Paragraph("2. Mission Profile", h2))
    if mission:
        m_rows = [
            ["Mission type", mission.get("mission_type", "-")],
            ["Waypoints", str(len(mission.get("waypoints", [])))],
            ["Total distance (km)", _fmt(mission.get("total_distance_km"))],
            ["Mission duration (min)", _fmt(mission.get("mission_duration_hr", 0) * 60)],
            ["Cruise altitude (m)", _fmt(mission.get("cruise_altitude_m"))],
            ["Mission floor / min safe altitude (m)", _fmt(mission.get("mission_floor_m"))],
            ["Total energy required (Wh)", _fmt(mission.get("total_energy_wh"))],
            ["Battery margin (%)", _fmt(mission.get("battery_margin_pct"))],
            ["Terrain elevation source", mission.get("elevation_source", "-")],
        ]
        tm = Table([["Metric", "Value"]] + m_rows, colWidths=[100 * mm, 70 * mm])
        tm.setStyle(_table_style())
        elements.append(tm)
        if mission.get("warnings"):
            elements.append(Spacer(1, 4))
            for w in mission["warnings"]:
                elements.append(Paragraph(f"\u25b2 {w}", small))
        w = mission.get("weather")
        if w and w.get("available"):
            elements.append(Spacer(1, 6))
            elements.append(Paragraph(
                f"<b>Weather at start waypoint:</b> {w.get('temperature_c')}\u00b0C, "
                f"{w.get('pressure_hpa')} hPa, {w.get('humidity_pct')}% humidity, "
                f"{w.get('wind_speed_ms')} m/s wind (source: {w.get('source')}). Informational only \u2014 "
                f"not yet fed back into the physics engine's atmosphere model.", small))
    else:
        elements.append(Paragraph(
            "No mission was planned for this report. Visit the Mission Planner to lay down waypoints, "
            "compute a terrain-aware cruise altitude and energy budget, and regenerate this report to "
            "include it here.", body))

    if flight_profile_image:
        try:
            image_payload = flight_profile_image.split(",", 1)[1] if "," in flight_profile_image else flight_profile_image
            image_bytes = base64.b64decode(image_payload)
            elements.append(Spacer(1, 8))
            elements.append(Paragraph("<b>Climb / Cruise / Descend Flight Profile</b>", body))
            elements.append(Spacer(1, 4))
            elements.append(Image(io.BytesIO(image_bytes), width=170 * mm, height=96 * mm))
        except Exception:
            elements.append(Spacer(1, 6))
            elements.append(Paragraph("Flight profile image could not be embedded in this report.", small))

    # --- 3. Physics engine results ---
    elements.append(Paragraph("3. Physics Engine Results", h2))
    elements.append(Paragraph(
        "Computed directly from ISA atmosphere and steady-level-flight aircraft-performance "
        "equations \u2014 transparent, auditable ground truth (no ML involved).", small))
    elements.append(Spacer(1, 4))
    phys_keys = ["min_altitude_m", "max_altitude_m", "mean_altitude_m", "recommended_altitude_m",
                 "service_ceiling_m", "absolute_ceiling_m", "rate_of_climb_ms", "range_km",
                 "endurance_hr", "power_required_w", "lift_n", "drag_n", "l_over_d",
                 "stall_speed_ms", "wing_loading_kg_m2", "power_loading_w_kg", "aspect_ratio"]
    phys_rows = [["Quantity", "Value"]] + [[k.replace("_", " ").title(), _fmt(physics_result.get(k))] for k in phys_keys]
    t2 = Table(phys_rows, colWidths=[85 * mm, 85 * mm])
    t2.setStyle(_table_style())
    elements.append(t2)
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(f"<b>Why this altitude was recommended:</b> {physics_result.get('recommended_reason','')}", body))

    # --- 4. Engine-out safety analysis ---
    eo = physics_result.get("engine_out")
    if eo:
        elements.append(Paragraph("4. Engine-Out Safety Analysis", h2))
        if eo.get("applicable"):
            maintain = eo.get("can_maintain_min_altitude")
            verdict_hex = "#04825A" if maintain else "#B45F06"
            verdict_text = "CAN maintain the minimum operating altitude" if maintain else "CANNOT maintain the minimum operating altitude"
            elements.append(Paragraph(
                f"With 1 of {n_engines} engines inoperative "
                f"({eo.get('power_loss_fraction', 0) * 100:.0f}% power loss), this aircraft "
                f"<font color='{verdict_hex}'><b>{verdict_text}</b></font>.", body))
            eo_rows = [
                ["Engines operating (scenario)", f"{eo.get('engines_operating')}"],
                ["Single-engine service ceiling (m)", _fmt(eo.get("single_engine_service_ceiling_m"))],
                ["Rate of climb at floor, 1 engine out (m/s)", _fmt(eo.get("single_engine_roc_at_min_alt_ms"))],
            ]
            t3 = Table([["Metric", "Value"]] + eo_rows, colWidths=[110 * mm, 60 * mm])
            t3.setStyle(_table_style())
            elements.append(Spacer(1, 4))
            elements.append(t3)
        else:
            elements.append(Paragraph(
                "Not applicable \u2014 this configuration has a single engine, so there is no "
                "redundant engine to evaluate an engine-out contingency against.", body))

    # --- 5. ML surrogate results ---
    elements.append(Paragraph("5. ML Surrogate Model Results", h2))
    elements.append(Paragraph(
        f"Predicted by the trained <b>{ml_result.get('model_used', 'ML')}</b> model from the same "
        f"design features \u2014 no physics simulation runs at inference time. Safety classifier "
        f"confidence: <b>{ml_result.get('safety_confidence', 0) * 100:.1f}%</b> \u00b7 "
        f"Reliability score: <b>{ml_result.get('reliability_score', 0) * 100:.0f}%</b>.", small))
    elements.append(Spacer(1, 4))
    ml_keys = ["min_altitude_m", "max_altitude_m", "mean_altitude_m", "recommended_altitude_m",
               "service_ceiling_m", "absolute_ceiling_m", "rate_of_climb_ms", "range_km",
               "endurance_hr", "power_required_w", "lift_n", "drag_n", "l_over_d",
               "safety_status", "safety_confidence", "model_used"]
    ml_rows = [["Quantity", "Value"]] + [[k.replace("_", " ").title(), _fmt(ml_result.get(k))] for k in ml_keys]
    t4 = Table(ml_rows, colWidths=[85 * mm, 85 * mm])
    t4.setStyle(_table_style())
    elements.append(t4)

    # --- 6. Physics vs ML comparison (table + chart) ---
    elements.append(Paragraph("6. Physics vs ML \u2014 Comparison", h2))
    comp_rows = [["Target", "Physics", "ML", "Diff %"]]
    for c in comparison:
        comp_rows.append([c["target"].replace("_", " ").title(), _fmt(c["physics_value"]),
                           _fmt(c["ml_value"]), f"{c['difference_pct']:.2f}%"])
    t5 = Table(comp_rows, colWidths=[70 * mm, 40 * mm, 40 * mm, 20 * mm])
    t5.setStyle(_table_style())
    elements.append(t5)
    elements.append(Spacer(1, 8))
    try:
        chart_buf = _make_comparison_chart(comparison)
        elements.append(Image(chart_buf, width=170 * mm, height=170 * mm * (3.2 / 7.2)))
    except Exception:
        pass

    # --- 7. Confidence intervals ---
    ci = ml_result.get("confidence_intervals") or {}
    if ci:
        elements.append(Paragraph("7. ML Confidence Intervals", h2))
        elements.append(Paragraph(
            "Prediction \u00b1 held-out RMSE for that specific target, from the trained model's own "
            "test-set error \u2014 not a fixed-percentage placeholder.", small))
        elements.append(Spacer(1, 4))
        ci_rows = [["Target", "Lower", "Prediction", "Upper", "\u00b1 RMSE"]]
        for k, v in ci.items():
            pred = ml_result.get(k)
            ci_rows.append([k.replace("_", " ").title(), _fmt(v.get("lower")), _fmt(pred),
                             _fmt(v.get("upper")), _fmt(v.get("rmse"))])
        t7 = Table(ci_rows, colWidths=[50 * mm, 30 * mm, 30 * mm, 30 * mm, 30 * mm])
        t7.setStyle(_table_style())
        elements.append(t7)

    # --- 8. Local explanation (SHAP-style) ---
    if local_explanation and local_explanation.get("contributions"):
        elements.append(Paragraph("8. Local Explanation \u2014 Why This Prediction", h2))
        elements.append(Paragraph(
            f"Occlusion-based local feature attribution for <b>{local_explanation.get('target','').replace('_',' ')}</b> "
            f"(in the spirit of SHAP \u2014 an approximation, not an exact Shapley-value computation). Each row shows "
            f"how much replacing that one feature with the training-set average shifts the prediction.", small))
        elements.append(Spacer(1, 4))
        exp_rows = [["Feature", "Value", "Training Avg", "Contribution"]]
        for c in local_explanation["contributions"][:8]:
            exp_rows.append([c["feature"].replace("_", " ").title(), _fmt(c["value"]),
                              _fmt(c["training_mean"]), f"{c['contribution']:+.2f}"])
        t8 = Table(exp_rows, colWidths=[60 * mm, 40 * mm, 40 * mm, 30 * mm])
        t8.setStyle(_table_style())
        elements.append(t8)

    # --- 9. Optimization suggestions ---
    if optimize_range or optimize_endurance:
        elements.append(Paragraph("9. Optimization Suggestions", h2))
        elements.append(Paragraph(
            "One-at-a-time physics-engine sensitivity (\u00b110%) \u2014 each row holds every other "
            "parameter fixed; this is not a joint optimizer.", small))
        elements.append(Spacer(1, 4))
        for title, suggestions in (("Range", optimize_range), ("Endurance", optimize_endurance)):
            if not suggestions:
                continue
            elements.append(Paragraph(f"<b>{title}</b>", body))
            rows = [["Parameter", "Current", "Suggested", "Projected Change"]]
            for s in suggestions[:4]:
                rows.append([s["label"], _fmt(s["current_value"]), _fmt(s["suggested_value"]),
                             f"{s['projected_change_pct']:+.1f}%"])
            tt = Table(rows, colWidths=[55 * mm, 35 * mm, 35 * mm, 45 * mm])
            tt.setStyle(_table_style())
            elements.append(tt)
            elements.append(Spacer(1, 4))

    # --- 10. Failure analysis ---
    if failure_results:
        elements.append(Paragraph("10. Failure Simulation", h2))
        elements.append(Paragraph(
            "Physics-engine re-evaluation under five off-nominal scenarios, compared to the baseline "
            "configuration above.", small))
        elements.append(Spacer(1, 4))
        for f in failure_results:
            if not f.get("applicable", True):
                elements.append(Paragraph(f"<b>{f['label']}:</b> {f['explanation']}", small))
                continue
            elements.append(Paragraph(f"<b>{f['label']}</b> \u2014 new safety status: "
                                       f"<font color='{'#04825A' if f['new_safety_status']=='SAFE' else ('#B45F06' if f['new_safety_status']=='CAUTION' else '#C81E1E')}'>"
                                       f"{f['new_safety_status']}</font>", body))
            elements.append(Paragraph(f["explanation"], small))
            elements.append(Spacer(1, 3))

    # --- 11. Design score ---
    if design_score:
        elements.append(Paragraph("11. Design Score", h2))
        elements.append(Paragraph(
            f"<b>{design_score['total']:.0f} / 100 \u2014 Grade {design_score['grade']}</b>", body))
        ds_rows = [["Component", "Points", "Max", "Detail"]]
        for k, v in design_score["breakdown"].items():
            ds_rows.append([k.replace("_", " ").title(), _fmt(v["points"]), _fmt(v["max"]), v["detail"]])
        tds = Table(ds_rows, colWidths=[50 * mm, 25 * mm, 20 * mm, 75 * mm])
        tds.setStyle(_table_style())
        elements.append(Spacer(1, 4))
        elements.append(tds)

    # --- 12. Safety warnings ---
    if physics_result.get("warnings"):
        elements.append(Paragraph("12. Safety Warnings", h2))
        for w in physics_result["warnings"]:
            elements.append(Paragraph(f"\u25b2 {w}", body))

    # --- Final recommendation + appendix ---
    elements.append(Paragraph("Final Engineering Recommendation", h2))
    rec_bits = [f"Physics-engine outputs are authoritative; ML outputs are a fast cross-check."]
    if design_score:
        rec_bits.append(f"Overall design score of {design_score['total']:.0f}/100 (Grade {design_score['grade']}) "
                         f"reflects current safety status, L/D, power margin, and ML reliability.")
    if failure_results:
        critical = [f["label"] for f in failure_results if f.get("new_safety_status") == "CRITICAL"]
        if critical:
            rec_bits.append(f"Flagged failure scenarios requiring mitigation before deployment: {', '.join(critical)}.")
        else:
            rec_bits.append("No simulated failure scenario pushed the aircraft into a CRITICAL safety state.")
    elements.append(Paragraph(" ".join(rec_bits), body))

    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#DCE5EE")))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "<b>Appendix \u2014 Methodology &amp; Limitations:</b> this platform uses a synthetic dataset "
        "generated from first-principles aerospace equations (ISA atmosphere, lift/drag polar, "
        "excess-power climb theory) to train the ML surrogate; it has not been validated against real "
        "flight-test telemetry. Local explanations use one-at-a-time occlusion (an approximation, not "
        "exact Shapley values). Optimization suggestions are one-at-a-time, not jointly optimized. The "
        "atmosphere model is a fixed ISA column (no live weather feedback yet). Treat all outputs as "
        "engineering-estimate guidance for early-stage design exploration, not certified airworthiness data.",
        small))

    doc.build(elements, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buf.getvalue()


def _fmt(v):
    if v is None:
        return "-"
    if isinstance(v, bool):
        return "Yes" if v else "No"
    if isinstance(v, float):
        return f"{v:,.3f}"
    return str(v)


def _table_style():
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DCE5EE")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ])


def build_csv_report(uav_input: dict, physics_result: dict, ml_result: dict) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Section", "Key", "Value"])
    for k, v in uav_input.items():
        writer.writerow(["Input", k, v])
    for k, v in physics_result.items():
        if k in ("envelope_profile", "warnings", "engine_out"):
            continue
        writer.writerow(["Physics", k, v])
    if physics_result.get("engine_out"):
        for k, v in physics_result["engine_out"].items():
            writer.writerow(["EngineOut", k, v])
    for k, v in ml_result.items():
        writer.writerow(["ML", k, v])
    return buf.getvalue()

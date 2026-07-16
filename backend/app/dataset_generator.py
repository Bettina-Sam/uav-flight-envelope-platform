"""
dataset_generator.py
---------------------
Generates the synthetic training dataset for the ML surrogate model.

METHOD
------
1. Randomly sample UAV *design* parameters within realistic bounds,
   stratified across three design-scale classes - mini (7-25 kg, 60% of
   samples), medium (25-300 kg, 25%), and large/HALE-class (300-3000 kg,
   15%) - so the model has real training density both at its original
   small-electric-UAV focus and at larger electric-equivalent scales (see
   SIZE_CLASSES below; these bounds are the "synthetic assumptions" that
   must be disclosed in the report, they are not measured from a real
   fleet). Scale-dependent parameters (mass, wing area, wingspan, battery,
   motor power) are sampled log-uniformly *within* whichever class was
   picked, so density is spread proportionally across orders of magnitude
   instead of linearly, and so parameter combinations stay physically
   coherent (a 3-tonne airframe never gets paired with a 0.3 m^2 wing).
2. For every sampled configuration, run the physics engine
   (`physics.compute_flight_envelope`) to get the ground-truth flight
   envelope (min/max altitude, service/absolute ceiling, recommended
   altitude) plus the full performance state AT the recommended altitude
   (lift, drag, L/D, power required/available, ROC, endurance, range).
3. Save one row per configuration. Each row = ML input features (design
   parameters) + ML target outputs (the 11 predicted quantities).

WHY ONE ROW PER CONFIGURATION (not per altitude)
-------------------------------------------------
The product question is "given this UAV design, what is its flight
envelope and recommended altitude?" - a design -> envelope mapping.
Altitude is an *output* of the physics engine's internal sweep, not an
ML input. This keeps the ML problem a clean multi-output regression
over UAV design parameters, matching the platform's actual use case
(engineer enters aircraft parameters once, gets the envelope).
"""

import csv
import math
import random
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import physics

# ---------------------------------------------------------------------------
# Sampling bounds - EXPLICIT SYNTHETIC ASSUMPTIONS
# ---------------------------------------------------------------------------
# Three design-scale classes, stratified so training density stays strong at
# the platform's original mini-UAV focus while genuinely extending coverage
# up to large HALE-class electric-equivalent designs (e.g. a TAPAS BH-201-
# scale reference aircraft). A flat/uniform widening of one shared range
# would badly under-sample the small end (which is still this platform's
# primary, best-validated use case) while wasting density in the enormous
# middle of a 3-order-of-magnitude span; log-uniform sampling *within* each
# class, plus keeping scale-dependent parameters (mass, wing area, wingspan,
# battery, motor power) correlated with the chosen class, avoids generating
# physically incoherent combinations (e.g. a 3-tonne airframe with a 0.3 m^2
# wing) that would pollute training for every class at once.
#
# MINI_SHARE / MEDIUM_SHARE / LARGE_SHARE below control sampling weight -
# mini stays dominant (60%) since it's the best-characterized, most-tested
# regime; medium (25%) and large/HALE (15%) extend real coverage rather than
# token coverage.
SIZE_CLASSES = {
    "mini": {
        "weight": 0.60,
        "mass_kg": (7.0, 25.0),
        "payload_kg": (0.0, 5.0),
        "wing_area_m2": (0.30, 0.95),
        "wingspan_m": (2.0, 4.2),
        "battery_wh": (500.0, 2000.0),
        "motor_max_power_w": (350.0, 1300.0),
        "cruise_speed_ms": (14.0, 30.0),
    },
    "medium": {
        "weight": 0.25,
        "mass_kg": (25.0, 300.0),
        "payload_kg": (5.0, 60.0),
        "wing_area_m2": (0.95, 6.0),
        "wingspan_m": (4.2, 9.0),
        "battery_wh": (2000.0, 15000.0),
        "motor_max_power_w": (1300.0, 15000.0),
        "cruise_speed_ms": (18.0, 45.0),
    },
    "large": {
        "weight": 0.15,
        "mass_kg": (300.0, 3000.0),
        "payload_kg": (60.0, 500.0),
        "wing_area_m2": (6.0, 25.0),
        "wingspan_m": (9.0, 20.0),
        "battery_wh": (15000.0, 150000.0),
        "motor_max_power_w": (15000.0, 600000.0),
        "cruise_speed_ms": (25.0, 70.0),
    },
}
SCALE_DEPENDENT_PARAMS = ["mass_kg", "payload_kg", "wing_area_m2", "wingspan_m",
                          "battery_wh", "motor_max_power_w", "cruise_speed_ms"]

# Aerodynamic/efficiency coefficients are NOT strongly scale-dependent (a
# well-designed 3-tonne HALE wing and a well-designed 15 kg mini-UAV wing
# can both have CD0 around 0.02-0.03), so these stay a single shared range
# across all size classes, widened slightly versus the original mini-only
# bounds to comfortably cover higher-CL, cleaner high-aspect-ratio designs.
BOUNDS = {
    "cl_max": (1.1, 2.0),
    "cd0": (0.018, 0.040),
    "oswald_efficiency": (0.70, 0.90),
    "prop_efficiency_static": (0.60, 0.85),
}

# New feature set (replacing the previous UAV design features)
BOUNDS = {
    "mass_kg": (7.0, 3000.0),
    "payload_kg": (0.0, 500.0),
    "wing_area_m2": (0.3, 25.0),
    "l_over_d": (5.0, 30.0),
    "cd0": (0.006, 0.08),
    "cruise_speed_ms": (8.0, 70.0),
    "air_density_kg_m3": (0.2, 1.3),
    "sfc_kg_per_n_s": (0.0, 0.00002),
    "thrust_to_weight": (0.01, 0.5),
    "propulsion_efficiency": (0.3, 0.95),
    "fuel_capacity_l": (0.0, 5000.0),
    "propeller_diameter_m": (0.1, 5.0),
    "battery_wh": (100.0, 150000.0),
    "battery_soc": (0.0, 1.0),
    "aux_power_w": (0.0, 2000.0),
}

FEATURE_COLUMNS = [
    "mass_kg", "payload_kg", "wing_area_m2", "l_over_d", "cd0", "cruise_speed_ms",
    "air_density_kg_m3", "sfc_kg_per_n_s", "thrust_to_weight", "propulsion_efficiency",
    "fuel_capacity_l", "propeller_diameter_m", "battery_wh", "battery_soc", "aux_power_w",
]

TARGET_COLUMNS = [
    "min_altitude_m", "max_altitude_m", "recommended_altitude_m",
    "service_ceiling_m", "absolute_ceiling_m", "rate_of_climb_ms",
    "range_km", "endurance_hr", "power_required_w", "lift_n", "drag_n",
    "l_over_d", "safety_status",
]

STATUS_TO_INT = {"SAFE": 0, "CAUTION": 1, "CRITICAL": 2}


def _log_uniform(rng: random.Random, lo: float, hi: float) -> float:
    """Samples proportionally across orders of magnitude rather than
    linearly - e.g. as many samples land in [10,100) as in [100,1000),
    which is the statistically correct way to cover a multi-decade span
    without wasting density at the top end. Falls back to plain uniform
    if the range doesn't support logs (lo <= 0)."""
    if lo <= 0:
        return rng.uniform(lo, hi)
    return math.exp(rng.uniform(math.log(lo), math.log(hi)))


def _pick_size_class(rng: random.Random) -> str:
    r = rng.random()
    cumulative = 0.0
    for name, cfg in SIZE_CLASSES.items():
        cumulative += cfg["weight"]
        if r <= cumulative:
            return name
    return "mini"


def sample_config(rng: random.Random) -> physics.UAVConfig:
    # Uniform (or log-uniform where sensible) sampling within the new BOUNDS
    mass = _log_uniform(rng, *BOUNDS["mass_kg"])
    # payload constrained to <= 40% of mass and within payload bound
    max_payload = min(BOUNDS["payload_kg"][1], 0.4 * mass)
    payload = rng.uniform(BOUNDS["payload_kg"][0], max(max_payload, BOUNDS["payload_kg"][0] + 0.1))

    wing_area = _log_uniform(rng, *BOUNDS["wing_area_m2"]) if rng.random() < 0.9 else rng.uniform(*BOUNDS["wing_area_m2"]) 
    l_over_d = rng.uniform(*BOUNDS["l_over_d"])
    cd0 = rng.uniform(*BOUNDS["cd0"])
    cruise_speed = rng.uniform(*BOUNDS["cruise_speed_ms"])
    air_density = rng.uniform(*BOUNDS["air_density_kg_m3"])
    sfc = rng.uniform(*BOUNDS["sfc_kg_per_n_s"])
    t_w = rng.uniform(*BOUNDS["thrust_to_weight"])
    prop_eff = rng.uniform(*BOUNDS["propulsion_efficiency"])
    fuel_cap = rng.uniform(*BOUNDS["fuel_capacity_l"])
    prop_d = rng.uniform(*BOUNDS["propeller_diameter_m"])
    battery_wh = _log_uniform(rng, *BOUNDS["battery_wh"])
    battery_soc = rng.uniform(*BOUNDS["battery_soc"])
    aux_power = rng.uniform(*BOUNDS["aux_power_w"])

    # Derive wingspan from an estimated aspect ratio. Approximate AR from L/D
    # using a simple empirical mapping (engineering assumption): AR ≈ max(4, min(30, 0.8 * L/D))
    ar_est = max(4.0, min(30.0, 0.8 * l_over_d))
    wingspan = math.sqrt(ar_est * wing_area)

    # Derive cl_max by solving quadratic from L/D = Cl / (Cd0 + Cl^2/(pi*e*AR))
    e = 0.85
    a = (l_over_d) / (math.pi * e * ar_est)
    b = -1.0
    c = l_over_d * cd0
    cl_max = 1.4
    disc = b * b - 4 * a * c
    if disc >= 0 and abs(a) > 1e-12:
        r1 = (-b + math.sqrt(disc)) / (2 * a)
        r2 = (-b - math.sqrt(disc)) / (2 * a)
        cl_cand = [r for r in (r1, r2) if r > 0]
        if cl_cand:
            cl_max = max(cl_cand)

    # Estimate motor power from T/W and cruise speed: Thrust = T/W * m * g
    thrust_n = t_w * mass * physics.G0
    motor_power = thrust_n * cruise_speed / max(prop_eff, 1e-3)

    uav = physics.UAVConfig(
        mass_kg=mass,
        payload_kg=payload,
        wing_area_m2=wing_area,
        wingspan_m=wingspan,
        cl_max=cl_max,
        cd0=cd0,
        oswald_efficiency=e,
        battery_energy_wh=battery_wh * battery_soc,
        motor_max_power_w=motor_power,
        num_engines=1,
        prop_efficiency_static=prop_eff,
        cruise_speed_ms=cruise_speed,
    )
    # attach sampled metadata so generate_row can include them in dataset rows
    setattr(uav, 'sampled_l_over_d', l_over_d)
    setattr(uav, 'sampled_air_density', air_density)
    setattr(uav, 'sampled_sfc', sfc)
    setattr(uav, 'sampled_thrust_to_weight', t_w)
    setattr(uav, 'sampled_propulsion_efficiency', prop_eff)
    setattr(uav, 'sampled_fuel_capacity_l', fuel_cap)
    setattr(uav, 'sampled_propeller_diameter_m', prop_d)
    setattr(uav, 'sampled_battery_soc', battery_soc)
    setattr(uav, 'sampled_aux_power_w', aux_power)
    return uav


def generate_row(uav: physics.UAVConfig) -> dict:
    envelope = physics.compute_flight_envelope(uav)
    rec_perf = physics.evaluate_altitude(uav, envelope.recommended_altitude_m)
    endurance = physics.endurance_hours(uav, rec_perf)
    rng_km = physics.range_km(rec_perf, endurance)
    status = physics.classify_status(uav, envelope, physics.engine_out_analysis(uav))

    row = {
        "mass_kg": uav.mass_kg,
        "payload_kg": uav.payload_kg,
        "wing_area_m2": uav.wing_area_m2,
        "l_over_d": rec_perf.l_over_d,
        "cd0": uav.cd0,
        "cruise_speed_ms": uav.cruise_speed_ms,
        "air_density_kg_m3": rec_perf.rho,
        "sfc_kg_per_n_s": getattr(uav, 'sampled_sfc', 0.0),
        "thrust_to_weight": getattr(uav, 'sampled_thrust_to_weight', 0.0),
        "propulsion_efficiency": getattr(uav, 'sampled_propulsion_efficiency', uav.prop_efficiency_static),
        "fuel_capacity_l": getattr(uav, 'sampled_fuel_capacity_l', 0.0),
        "propeller_diameter_m": getattr(uav, 'sampled_propeller_diameter_m', 0.0),
        "battery_wh": uav.battery_energy_wh,
        "battery_soc": getattr(uav, 'sampled_battery_soc', 1.0),
        "aux_power_w": getattr(uav, 'sampled_aux_power_w', 0.0),
        # targets
        "min_altitude_m": envelope.min_altitude_m,
        "max_altitude_m": envelope.max_altitude_m,
        "recommended_altitude_m": envelope.recommended_altitude_m,
        "service_ceiling_m": envelope.service_ceiling_m,
        "absolute_ceiling_m": envelope.absolute_ceiling_m,
        "rate_of_climb_ms": rec_perf.rate_of_climb_ms,
        "range_km": rng_km,
        "endurance_hr": endurance,
        "power_required_w": rec_perf.power_required_w,
        "lift_n": rec_perf.lift_n,
        "drag_n": rec_perf.drag_n,
        "l_over_d": rec_perf.l_over_d,
        "safety_status": STATUS_TO_INT[status["status"]],
    }
    return row


def generate_dataset(n_samples: int = 6000, seed: int = 42, out_path: str = None) -> str:
    rng = random.Random(seed)
    out_path = out_path or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "uav_synthetic_dataset.csv"
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    fieldnames = FEATURE_COLUMNS + TARGET_COLUMNS
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        written = 0
        attempts = 0
        while written < n_samples and attempts < n_samples * 3:
            attempts += 1
            uav = sample_config(rng)
            try:
                row = generate_row(uav)
            except (ZeroDivisionError, ValueError):
                continue
            writer.writerow(row)
            written += 1

    print(f"[dataset_generator] wrote {written} rows to {out_path}")
    return out_path


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=6000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=str, default=None)
    args = parser.parse_args()
    generate_dataset(n_samples=args.n, seed=args.seed, out_path=args.out)

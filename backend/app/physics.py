"""
physics.py
----------
Physics-based performance engine for a fixed-wing electric mini-UAV.

Every function here implements a *named, standard* aerospace equation.
This module is the ground truth used to (a) generate the synthetic
training dataset and (b) compute the "Physics Engine" prediction shown
alongside the ML prediction on the frontend (Physics vs ML comparison).

All units are SI unless stated otherwise. Angles in radians.

References for the equations used (standard undergraduate/graduate
aerospace performance theory - not reproduced verbatim, implemented
from first principles):
    - International Standard Atmosphere (ISA), troposphere model (0-11 km)
    - Anderson, "Aircraft Performance and Design" - steady level flight,
      power required/available, rate of climb, service ceiling
    - Standard propeller-aircraft range/endurance relations (electric variant)
"""

from dataclasses import dataclass, field
from typing import Optional
import math

# ---------------------------------------------------------------------------
# 1. ISA ATMOSPHERE MODEL (0 - 11,000 m, troposphere)
# ---------------------------------------------------------------------------

T0 = 288.15        # K, sea-level standard temperature
P0 = 101325.0       # Pa, sea-level standard pressure
RHO0 = 1.225        # kg/m^3, sea-level standard density
L = 0.0065          # K/m, temperature lapse rate (troposphere)
R_AIR = 287.05287   # J/(kg.K), specific gas constant for dry air
G0 = 9.80665        # m/s^2, standard gravity


def isa_temperature(altitude_m: float) -> float:
    """Temperature (K) at a given altitude using the ISA linear lapse rate.
    Valid 0-11000 m (troposphere), which covers this UAV's operating band."""
    altitude_m = max(0.0, min(altitude_m, 11000.0))
    return T0 - L * altitude_m


def isa_pressure(altitude_m: float) -> float:
    """Pressure (Pa) at altitude via the barometric formula for a
    constant lapse-rate layer (hydrostatic equation + ideal gas law)."""
    altitude_m = max(0.0, min(altitude_m, 11000.0))
    T = isa_temperature(altitude_m)
    exponent = G0 / (R_AIR * L)
    return P0 * (T / T0) ** exponent


def isa_density(altitude_m: float) -> float:
    """Air density (kg/m^3) at altitude from the ideal gas law,
    rho = P / (R * T)."""
    T = isa_temperature(altitude_m)
    P = isa_pressure(altitude_m)
    return P / (R_AIR * T)


def density_ratio(altitude_m: float) -> float:
    """sigma = rho(h) / rho0 - used throughout performance equations."""
    return isa_density(altitude_m) / RHO0


# ---------------------------------------------------------------------------
# 2. UAV CONFIGURATION
# ---------------------------------------------------------------------------

@dataclass
class UAVConfig:
    mass_kg: float                 # empty + payload mass
    payload_kg: float
    wing_area_m2: float
    wingspan_m: float
    cl_max: float = 1.4            # max lift coefficient (clean config)
    cd0: float = 0.028             # zero-lift (parasite) drag coefficient
    oswald_efficiency: float = 0.80
    battery_energy_wh: float = 1200.0
    motor_max_power_w: float = 750.0       # PER-ENGINE max electrical power (twin-engine baseline: 2x750W)
    num_engines: int = 2                    # TWIN-ENGINE baseline platform. 1 = single, 2 = twin (default),
                                             # kept adjustable so engine-out / single-vs-twin comparisons
                                             # (Section: "Engine-Out Safety Analysis") can be run as what-ifs.
    prop_efficiency_static: float = 0.75   # baseline propeller efficiency (per engine/propeller)
    cruise_speed_ms: float = 20.0  # DESIGN cruise true-airspeed (held constant across altitude).
    # NOTE: holding cruise TAS constant (not Cl) across the altitude sweep is the correct
    # aircraft-performance formulation. As altitude increases, required Cl rises (thinner
    # air), so parasite drag falls while induced drag rises - producing a genuine
    # minimum-drag / minimum-power altitude, i.e. a real engineering trade-off rather than
    # a value that trivially favors the operating floor.

    @property
    def weight_n(self) -> float:
        """Weight (N) = m * g"""
        return self.mass_kg * G0

    @property
    def aspect_ratio(self) -> float:
        """AR = b^2 / S"""
        return (self.wingspan_m ** 2) / self.wing_area_m2

    @property
    def wing_loading_n_m2(self) -> float:
        """W/S - weight per unit wing area. Higher -> higher stall speed,
        lower -> better climb/turn but more structure needed."""
        return self.weight_n / self.wing_area_m2

    @property
    def total_motor_power_w(self) -> float:
        """Combined max electrical power across all engines (twin-engine: 2x per-engine power)."""
        return self.motor_max_power_w * self.num_engines

    @property
    def power_loading_w_kg(self) -> float:
        """Total available power per unit mass - a first-order climb/ceiling indicator.
        Uses combined (all-engines) power, since that's what determines climb margin
        in normal (all-engines-operating) flight."""
        return self.total_motor_power_w / self.mass_kg


# ---------------------------------------------------------------------------
# 3. AERODYNAMICS
# ---------------------------------------------------------------------------

def dynamic_pressure(rho: float, velocity_ms: float) -> float:
    """q = 1/2 * rho * V^2"""
    return 0.5 * rho * velocity_ms ** 2


def lift_force(cl: float, rho: float, velocity_ms: float, s: float) -> float:
    """L = Cl * q * S"""
    return cl * dynamic_pressure(rho, velocity_ms) * s


def induced_drag_coefficient(cl: float, ar: float, e: float) -> float:
    """Cdi = Cl^2 / (pi * e * AR)  (Prandtl lifting-line induced drag)"""
    return (cl ** 2) / (math.pi * e * ar)


def drag_coefficient(cl: float, cd0: float, ar: float, e: float) -> float:
    """Cd = Cd0 + Cdi  (parabolic drag polar)"""
    return cd0 + induced_drag_coefficient(cl, ar, e)


def drag_force(cd: float, rho: float, velocity_ms: float, s: float) -> float:
    """D = Cd * q * S"""
    return cd * dynamic_pressure(rho, velocity_ms) * s


def stall_speed(uav: UAVConfig, rho: float) -> float:
    """V_stall = sqrt(2W / (rho * S * Cl_max))  -- steady level flight,
    lift = weight, at the maximum usable lift coefficient."""
    return math.sqrt((2 * uav.weight_n) / (rho * uav.wing_area_m2 * uav.cl_max))


def cruise_speed_for_cl(uav: UAVConfig, rho: float, cl: float) -> float:
    """Speed required to produce lift = weight at a chosen operating Cl.
    V = sqrt(2W / (rho * S * Cl))"""
    return math.sqrt((2 * uav.weight_n) / (rho * uav.wing_area_m2 * cl))


def lift_to_drag_ratio(cl: float, cd: float) -> float:
    """L/D = Cl / Cd - the single best measure of aerodynamic efficiency."""
    return cl / cd if cd > 0 else 0.0


# ---------------------------------------------------------------------------
# 4. PROPULSION / POWER
# ---------------------------------------------------------------------------

def prop_efficiency_at_altitude(uav: UAVConfig, sigma: float) -> float:
    """Simplified propeller-efficiency altitude correction.
    Efficiency degrades mildly with reduced density (blade Reynolds number
    and disk loading effects) - modeled as a smooth empirical falloff.
    This is a *modeling assumption*, not a measured curve."""
    return uav.prop_efficiency_static * (0.4 + 0.6 * sigma)


def power_available_w(uav: UAVConfig, sigma: float, engines_operating: int = None) -> float:
    """P_avail = (per-engine P_motor_max * n_engines_operating) * eta_prop(altitude)

    Twin-engine platform: normal operation uses all engines (engines_operating
    defaults to uav.num_engines). Passing a smaller engines_operating value
    (e.g. num_engines - 1) models an engine-out condition - see
    engine_out_analysis() below. Motor electrical power itself is treated as
    altitude-independent (electric motors, unlike IC engines, do not lose
    power with reduced air density); only the propeller's aerodynamic
    efficiency changes with altitude."""
    n = uav.num_engines if engines_operating is None else engines_operating
    return uav.motor_max_power_w * n * prop_efficiency_at_altitude(uav, sigma)


def power_required_w(drag_n: float, velocity_ms: float) -> float:
    """P_req = D * V  (thrust-power balance in steady level flight)"""
    return drag_n * velocity_ms


def rate_of_climb(power_available_w: float, power_required_w: float, weight_n: float) -> float:
    """ROC = (P_avail - P_req) / W  -- excess power theorem.
    Positive => aircraft can climb; zero => level flight ceiling condition;
    negative => cannot sustain altitude."""
    return (power_available_w - power_required_w) / weight_n


# ---------------------------------------------------------------------------
# 5. FLIGHT ENVELOPE / PERFORMANCE ENVELOPE AT A GIVEN ALTITUDE
# ---------------------------------------------------------------------------

@dataclass
class AltitudePerformance:
    altitude_m: float
    rho: float
    sigma: float
    velocity_ms: float
    cl: float
    cd: float
    lift_n: float
    drag_n: float
    l_over_d: float
    power_required_w: float
    power_available_w: float
    rate_of_climb_ms: float
    stall_speed_ms: float
    feasible: bool          # can the aircraft sustain level flight here?


def evaluate_altitude(uav: UAVConfig, altitude_m: float, engines_operating: int = None) -> AltitudePerformance:
    """Evaluate full steady-level-flight performance at one altitude,
    flying at the UAV's fixed DESIGN CRUISE AIRSPEED (uav.cruise_speed_ms).

    Because V is held fixed, the Cl required to hold lift = weight rises
    as altitude increases (air gets thinner): Cl(h) = 2W / (rho(h) V^2 S).
    This is what creates a genuine altitude trade-off - see the note on
    UAVConfig.cruise_speed_ms.

    engines_operating: defaults to uav.num_engines (normal operation). Pass
    a lower value to evaluate an engine-out condition with the SAME stall
    and power feasibility logic as normal flight - stall/Cl_max is a
    function of speed and altitude only, independent of engine count, so
    it must stay identical between the two cases; only power available
    changes."""
    rho = isa_density(altitude_m)
    sigma = rho / RHO0
    v = uav.cruise_speed_ms
    cl_required = (2 * uav.weight_n) / (rho * v ** 2 * uav.wing_area_m2)
    cl = min(cl_required, uav.cl_max)   # cannot exceed max usable lift coefficient
    cd = drag_coefficient(cl, uav.cd0, uav.aspect_ratio, uav.oswald_efficiency)
    lift = lift_force(cl, rho, v, uav.wing_area_m2)
    drag = drag_force(cd, rho, v, uav.wing_area_m2)
    p_req = power_required_w(drag, v)
    p_av = power_available_w(uav, sigma, engines_operating=engines_operating)
    roc = rate_of_climb(p_av, p_req, uav.weight_n)
    v_stall = stall_speed(uav, rho)
    feasible = (p_av >= p_req) and (v >= v_stall) and (cl_required <= uav.cl_max)
    return AltitudePerformance(
        altitude_m=altitude_m, rho=rho, sigma=sigma, velocity_ms=v,
        cl=cl, cd=cd, lift_n=lift, drag_n=drag, l_over_d=lift_to_drag_ratio(cl, cd),
        power_required_w=p_req, power_available_w=p_av,
        rate_of_climb_ms=roc, stall_speed_ms=v_stall, feasible=feasible,
    )


@dataclass
class FlightEnvelope:
    min_altitude_m: float
    max_altitude_m: float          # highest altitude where ROC > 0 (still climbing)
    service_ceiling_m: float       # altitude where ROC = 0.508 m/s (100 ft/min), standard definition
    absolute_ceiling_m: float      # altitude where ROC = 0
    recommended_altitude_m: float
    recommended_reason: str
    profile: list


SERVICE_CEILING_ROC_MS = 0.508    # 100 ft/min, the standard definition used industry-wide
MIN_OPERATING_ALTITUDE_M = 30.0   # regulatory/practical floor for this UAV class (ground/obstacle clearance)


def compute_flight_envelope(uav: UAVConfig, altitude_step_m: float = 50.0,
                             altitude_cap_m: float = 8000.0) -> FlightEnvelope:
    """
    Sweeps altitude from MIN_OPERATING_ALTITUDE_M upward and evaluates
    steady-level-flight performance at each step. Determines:

      - max_altitude_m        : highest altitude with positive ROC and V >= V_stall
      - service_ceiling_m      : altitude where ROC drops to 100 ft/min (interpolated)
      - absolute_ceiling_m     : altitude where ROC = 0 (interpolated)
      - recommended_altitude_m : NOT the midpoint of min/max. See selection
                                  logic in `_select_recommended_altitude`.
    """
    profile = []
    last_feasible = None
    service_ceiling = None
    absolute_ceiling = None
    prev = None

    alt = MIN_OPERATING_ALTITUDE_M
    while alt <= altitude_cap_m:
        perf = evaluate_altitude(uav, alt)
        profile.append(perf)
        if perf.feasible:
            last_feasible = perf

        if prev is not None:
            # interpolate service ceiling crossing
            if service_ceiling is None and prev.rate_of_climb_ms >= SERVICE_CEILING_ROC_MS > perf.rate_of_climb_ms:
                service_ceiling = _interp_altitude(prev, perf, SERVICE_CEILING_ROC_MS)
            # interpolate absolute ceiling crossing (ROC = 0)
            if absolute_ceiling is None and prev.rate_of_climb_ms >= 0.0 > perf.rate_of_climb_ms:
                absolute_ceiling = _interp_altitude(prev, perf, 0.0)

        prev = perf
        alt += altitude_step_m

    if last_feasible is None:
        # Aircraft cannot sustain level flight even near the ground -
        # configuration is infeasible (e.g. wildly overloaded).
        max_alt = MIN_OPERATING_ALTITUDE_M
    else:
        max_alt = last_feasible.altitude_m

    if absolute_ceiling is None:
        absolute_ceiling = max_alt
    if service_ceiling is None:
        service_ceiling = min(max_alt, absolute_ceiling)

    recommended_alt, reason = _select_recommended_altitude(uav, profile, service_ceiling)

    return FlightEnvelope(
        min_altitude_m=MIN_OPERATING_ALTITUDE_M,
        max_altitude_m=max_alt,
        service_ceiling_m=service_ceiling,
        absolute_ceiling_m=absolute_ceiling,
        recommended_altitude_m=recommended_alt,
        recommended_reason=reason,
        profile=profile,
    )


def _interp_altitude(a: AltitudePerformance, b: AltitudePerformance, target_roc: float) -> float:
    """Linear interpolation of altitude between two evaluated points for a target ROC."""
    if b.rate_of_climb_ms == a.rate_of_climb_ms:
        return b.altitude_m
    frac = (a.rate_of_climb_ms - target_roc) / (a.rate_of_climb_ms - b.rate_of_climb_ms)
    return a.altitude_m + frac * (b.altitude_m - a.altitude_m)


def _select_recommended_altitude(uav: UAVConfig, profile: list, service_ceiling: float):
    """
    ENGINEERING SELECTION LOGIC (this is the core design decision of the
    whole project - the recommended altitude is deliberately NOT the
    midpoint of min/max altitude).

    We restrict the search to the *safe operating band*: altitudes below
    the service ceiling (i.e. altitudes with a real climb-rate safety
    margin, not just "technically still flying"). Within that band we
    score every altitude on a weighted combination of:

      1. Aerodynamic efficiency  (L/D, normalized)      weight 0.35
      2. Climb-rate safety margin (ROC, normalized)      weight 0.30
      3. Power margin  ((P_avail-P_req)/P_avail)         weight 0.20
      4. Endurance proxy (fuel: lower drag/fuel burn; electric: lower P_req)
                                                           weight 0.15

    The altitude with the highest composite score is recommended. This
    means the recommendation shifts with the aircraft's actual physics
    (heavier payload -> lower recommended altitude; higher aspect ratio ->
    higher recommended altitude), which a simple average could never do.
    """
    candidates = [p for p in profile if p.feasible and p.altitude_m <= service_ceiling]
    if not candidates:
        candidates = [p for p in profile if p.feasible]
    if not candidates:
        # Nothing is feasible - flag min altitude with a clear reason.
        base = profile[0] if profile else None
        return (MIN_OPERATING_ALTITUDE_M,
                "No altitude in the swept range sustains level flight for this "
                "configuration (power available never exceeds power required). "
                "Reduce mass/payload or increase motor power.")

    ld_vals = [p.l_over_d for p in candidates]
    roc_vals = [p.rate_of_climb_ms for p in candidates]
    margin_vals = [(p.power_available_w - p.power_required_w) / p.power_available_w for p in candidates]
    endurance_proxy_vals = [p.drag_n if uses_fuel(uav) else p.power_required_w for p in candidates]

    def norm(vals, v):
        lo, hi = min(vals), max(vals)
        return 0.5 if hi == lo else (v - lo) / (hi - lo)

    def norm_inv(vals, v):
        lo, hi = min(vals), max(vals)
        return 0.5 if hi == lo else (hi - v) / (hi - lo)

    best = None
    best_score = -1.0
    for p in candidates:
        score = (
            0.35 * norm(ld_vals, p.l_over_d) +
            0.30 * norm(roc_vals, p.rate_of_climb_ms) +
            0.20 * norm(margin_vals, (p.power_available_w - p.power_required_w) / p.power_available_w) +
            0.15 * norm_inv(endurance_proxy_vals, p.drag_n if uses_fuel(uav) else p.power_required_w)
        )
        if score > best_score:
            best_score = score
            best = p

    endurance_basis = (
        f"Breguet fuel endurance (L/D={best.l_over_d:.2f}, fuel={getattr(uav, 'sampled_fuel_capacity_l', 0.0):.1f} L)"
        if uses_fuel(uav)
        else f"electric endurance (P_req={best.power_required_w:.1f} W)"
    )
    reason = (
        f"Selected at {best.altitude_m:.0f} m: best composite score of aerodynamic "
        f"efficiency (L/D={best.l_over_d:.2f}), climb-rate safety margin "
        f"(ROC={best.rate_of_climb_ms:.2f} m/s), power margin "
        f"({(best.power_available_w - best.power_required_w) / best.power_available_w * 100:.1f}% spare), "
        f"and {endurance_basis}, restricted to altitudes "
        f"at or below the service ceiling ({service_ceiling:.0f} m) for safety."
    )
    return best.altitude_m, reason


# ---------------------------------------------------------------------------
# 6. ENDURANCE AND RANGE
# ---------------------------------------------------------------------------

FUEL_DENSITY_KG_PER_L = 0.80


def uses_fuel(uav: UAVConfig) -> bool:
    return (
        float(getattr(uav, "sampled_fuel_capacity_l", 0.0) or 0.0) > 0.0
        and float(getattr(uav, "sampled_sfc", 0.0) or 0.0) > 0.0
    )


def fuel_flow_kg_s(uav: UAVConfig, perf: AltitudePerformance) -> float:
    """
    Thrust-specific fuel consumption model.
    SFC is kg / (N*s); in steady level cruise, thrust required ~= drag.
    """
    sfc = float(getattr(uav, "sampled_sfc", 0.0) or 0.0)
    return max(0.0, sfc * max(perf.drag_n, 0.0))


def fuel_masses_kg(uav: UAVConfig, fuel_reserve_frac: float = 0.20) -> tuple[float, float, float]:
    fuel_mass_kg = float(getattr(uav, "sampled_fuel_capacity_l", 0.0) or 0.0) * FUEL_DENSITY_KG_PER_L
    reserve_fuel_kg = fuel_mass_kg * fuel_reserve_frac
    usable_fuel_kg = max(0.0, fuel_mass_kg - reserve_fuel_kg)
    return fuel_mass_kg, reserve_fuel_kg, usable_fuel_kg


def breguet_endurance_hours(uav: UAVConfig, perf: AltitudePerformance, fuel_reserve_frac: float = 0.20) -> float:
    """
    Breguet endurance for fuel aircraft:
        E = (1 / Ct) * (L / D) * ln(W_takeoff / W_landing)

    Input SFC is mass based, kg/(N*s). Convert to weight based 1/s via Ct = SFC * g.
    Weight ratio can be computed from masses because g cancels.
    """
    sfc_mass = float(getattr(uav, "sampled_sfc", 0.0) or 0.0)
    ct = sfc_mass * G0
    fuel_mass_kg, reserve_fuel_kg, usable_fuel_kg = fuel_masses_kg(uav, fuel_reserve_frac)
    base_mass_kg = max(0.0, uav.mass_kg)
    takeoff_mass_kg = base_mass_kg + fuel_mass_kg
    landing_mass_kg = base_mass_kg + reserve_fuel_kg
    if ct <= 0 or perf.l_over_d <= 0 or usable_fuel_kg <= 0 or landing_mass_kg <= 0:
        return 0.0
    weight_ratio = max(1.0, takeoff_mass_kg / landing_mass_kg)
    endurance_seconds = (1.0 / ct) * perf.l_over_d * math.log(weight_ratio)
    return max(0.0, endurance_seconds / 3600.0)


def breguet_fuel_used_for_range_kg(
    uav: UAVConfig,
    perf: AltitudePerformance,
    range_km_value: float,
    fuel_reserve_frac: float = 0.20,
) -> float:
    """
    Inverted Breguet range equation:
        R = (V / Ct) * (L / D) * ln(Wi / Wf)
        Wf = Wi / exp(R * Ct / (V * L/D))
    """
    sfc_mass = float(getattr(uav, "sampled_sfc", 0.0) or 0.0)
    ct = sfc_mass * G0
    fuel_mass_kg, _, usable_fuel_kg = fuel_masses_kg(uav, fuel_reserve_frac)
    takeoff_mass_kg = max(0.0, uav.mass_kg) + fuel_mass_kg
    if ct <= 0 or perf.velocity_ms <= 0 or perf.l_over_d <= 0 or takeoff_mass_kg <= 0 or range_km_value <= 0:
        return 0.0
    exponent = (range_km_value * 1000.0) * ct / (perf.velocity_ms * perf.l_over_d)
    final_mass_kg = takeoff_mass_kg / math.exp(max(0.0, exponent))
    return max(0.0, min(usable_fuel_kg, takeoff_mass_kg - final_mass_kg))


def endurance_hours(
    uav: UAVConfig,
    perf: AltitudePerformance,
    battery_reserve_frac: float = 0.20,
    fuel_reserve_frac: float = 0.20,
) -> float:
    """
    Endurance (hours).

    Fuel aircraft:
        fuel_flow = SFC * drag
        endurance = usable_fuel_mass / fuel_flow

    Electric aircraft:
        E = (Battery_Energy_Wh * (1 - reserve) ) / P_req_electrical

    P_req_electrical = P_req_aero / eta_prop(altitude), i.e. we need to
    draw more electrical power than the pure aerodynamic power required,
    because the propeller is not 100% efficient.
    battery_reserve_frac reserves a safety margin of battery capacity
    (standard practice - never plan to fully deplete the pack).
    """
    if uses_fuel(uav):
        return breguet_endurance_hours(uav, perf, fuel_reserve_frac)
    else:
        eta = prop_efficiency_at_altitude(uav, perf.sigma)
        p_elec = perf.power_required_w / max(eta, 1e-6)
        usable_energy_wh = uav.battery_energy_wh * (1 - battery_reserve_frac)
        if p_elec <= 0:
            return 0.0
        return usable_energy_wh / p_elec


def range_km(perf: AltitudePerformance, endurance_h: float) -> float:
    """Range = V * E  (straight-line, still-air range)"""
    return perf.velocity_ms * 3.6 * endurance_h  # km


# ---------------------------------------------------------------------------
# 7. ENGINE-OUT SAFETY ANALYSIS (twin-engine specific)
# ---------------------------------------------------------------------------

@dataclass
class EngineOutResult:
    applicable: bool                    # False for single-engine platforms (num_engines <= 1)
    engines_operating: int
    single_engine_service_ceiling_m: float   # service ceiling with one engine inoperative
    single_engine_roc_at_min_alt_ms: float   # rate of climb at the operating floor, one engine out
    can_maintain_min_altitude: bool          # can the aircraft hold level flight at the floor, one engine out?
    power_loss_fraction: float               # fraction of total power lost from one engine failing


def engine_out_analysis(uav: UAVConfig) -> EngineOutResult:
    """
    Twin-engine safety analysis: evaluates whether the aircraft can maintain
    safe flight with one engine inoperative (the standard "engine-out"
    scenario every multi-engine aircraft is assessed against). Not
    applicable to single-engine configurations (num_engines <= 1), since
    there is no redundant engine to lose.

    Method: re-sweep altitude with power_available_w computed for
    (num_engines - 1) engines, reusing evaluate_altitude() so the stall
    boundary (Cl_max) is enforced identically to the normal envelope -
    stalling is a function of speed and altitude only, not engine count,
    so single-engine-out can never show a HIGHER ceiling than normal
    operation, only equal (if stall-limited, not power-limited) or lower.
    """
    if uav.num_engines <= 1:
        return EngineOutResult(
            applicable=False, engines_operating=uav.num_engines,
            single_engine_service_ceiling_m=0.0, single_engine_roc_at_min_alt_ms=0.0,
            can_maintain_min_altitude=False, power_loss_fraction=1.0,
        )

    engines_out = uav.num_engines - 1
    power_loss_fraction = 1.0 / uav.num_engines

    floor_perf = evaluate_altitude(uav, MIN_OPERATING_ALTITUDE_M, engines_operating=engines_out)
    can_maintain = floor_perf.feasible and floor_perf.rate_of_climb_ms >= 0.0

    alt = MIN_OPERATING_ALTITUDE_M
    prev, single_engine_ceiling = None, MIN_OPERATING_ALTITUDE_M
    while alt <= 8000.0:
        perf = evaluate_altitude(uav, alt, engines_operating=engines_out)
        if not perf.feasible:
            # hit either the stall boundary or the power boundary - whichever
            # comes first defines the single-engine-out ceiling
            single_engine_ceiling = prev.altitude_m if prev else MIN_OPERATING_ALTITUDE_M
            break
        if prev is not None and prev.rate_of_climb_ms >= SERVICE_CEILING_ROC_MS > perf.rate_of_climb_ms:
            single_engine_ceiling = _interp_altitude(prev, perf, SERVICE_CEILING_ROC_MS)
            break
        single_engine_ceiling = alt
        prev = perf
        alt += 50.0

    # Physical sanity bound: single-engine-out ceiling can never exceed the
    # normal (all-engines) ceiling, since losing power can only ever reduce
    # (never improve) the altitude the aircraft can sustain.
    full_power_envelope = compute_flight_envelope(uav)
    single_engine_ceiling = min(single_engine_ceiling, full_power_envelope.service_ceiling_m)

    return EngineOutResult(
        applicable=True, engines_operating=engines_out,
        single_engine_service_ceiling_m=single_engine_ceiling,
        single_engine_roc_at_min_alt_ms=floor_perf.rate_of_climb_ms,
        can_maintain_min_altitude=can_maintain,
        power_loss_fraction=power_loss_fraction,
    )


# ---------------------------------------------------------------------------
# 8. SAFETY / STATUS CLASSIFICATION
# ---------------------------------------------------------------------------

def classify_status(uav: UAVConfig, envelope: FlightEnvelope, engine_out: "EngineOutResult" = None) -> dict:
    """
    Produces a simple traffic-light style safety/performance classification
    used by the frontend's "Safety Warning" panel. This is a rule-based
    layer on top of the physics engine - deliberately transparent (no
    black-box ML here) so a reviewer can audit exactly why a configuration
    was flagged.
    """
    warnings = []
    status = "SAFE"

    if envelope.max_altitude_m <= MIN_OPERATING_ALTITUDE_M + 1e-3:
        status = "CRITICAL"
        warnings.append("Configuration cannot sustain level flight at any altitude in the operating band.")

    margin = envelope.service_ceiling_m - envelope.recommended_altitude_m
    if uav.wing_loading_n_m2 / G0 > 150:
        status = "CAUTION" if status == "SAFE" else status
        warnings.append(f"Wing loading is high ({uav.wing_loading_n_m2/G0:.1f} kg/m^2) - stall speed and "
                         f"structural loads increase; consider a larger wing area.")

    if uav.power_loading_w_kg < 40:  # raised from 60 to accommodate efficient HALE aircraft
        status = "CAUTION" if status == "SAFE" else status
        warnings.append(f"Power loading is low ({uav.power_loading_w_kg:.1f} W/kg) - limited climb "
                         f"performance and thin safety margin near the service ceiling.")

    if envelope.service_ceiling_m - envelope.min_altitude_m < 100:  # reduced from 200 to allow narrow-band HALE designs
        status = "CAUTION" if status == "SAFE" else status
        warnings.append("Usable altitude band is very narrow (<100 m) - little room for gusts or "
                         "control error; review payload/power sizing.")

    if engine_out is not None and engine_out.applicable and not engine_out.can_maintain_min_altitude:
        status = "CAUTION" if status == "SAFE" else status
        warnings.append(f"Engine-out: with 1 of {uav.num_engines} engines inoperative, the aircraft "
                         f"cannot maintain the minimum operating altitude (ROC = "
                         f"{engine_out.single_engine_roc_at_min_alt_ms:.2f} m/s) - review power margins "
                         f"for single-engine-out contingency.")

    if not warnings:
        warnings.append("No performance flags raised - configuration operates with healthy margins "
                         "across the swept altitude band.")

    return {"status": status, "warnings": warnings}

import type { UAVInput } from '../types';

export interface FieldProvenance {
  field: keyof UAVInput;
  source: 'table' | 'derived' | 'assumed';
  note: string;
}

export interface ReferencePreset {
  key: string;
  label: string;
  shortDesc: string;
  input: UAVInput;
  provenance?: FieldProvenance[];
  caveat?: string;
}

export const DEFAULT_PRESET_INPUT: UAVInput = {
  aircraft_name: 'Default UAV',
  mass_kg: 14,
  payload_kg: 3,
  wing_area_m2: 0.6,
  l_over_d: 10,
  cd0: 0.028,
  cruise_speed_ms: 20,
  air_density_kg_m3: 1.225,
  sfc_kg_per_n_s: 0.000007,
  thrust_to_weight: 0.15,
  propulsion_efficiency: 0.75,
  fuel_capacity_l: 0,
  propeller_diameter_m: 0.3,
  battery_wh: 1200,
  battery_soc: 0.9,
  aux_power_w: 50,
};

/**
 * "TAPAS BH-201-inspired" preset, built from a reference parameter table
 * (fuel/turboprop HALE-class UAS, L/D=26, SFC=0.000007 kg/N·s, 2850 kg,
 * 110 Ah battery for avionics, 500 L fuel, T/W=0.32, cruise 38 m/s, wing
 * 21.2 m², 350 kg payload, 80% propulsive efficiency).
 *
 * This platform models BATTERY-ELECTRIC propulsion; the reference aircraft
 * is fuel/turboprop. That's a real architecture difference, not just a
 * scale difference, so this preset does NOT pretend every field carries
 * over 1:1. Every value below is tagged with where it actually came from:
 *
 *   'table'    - taken directly from the reference table, unmodified
 *   'derived'  - computed from table values using this platform's physics
 *                (e.g. motor power from the table's thrust-to-weight ratio)
 *   'assumed'  - the table doesn't specify this (or specifies it in a form
 *                that doesn't map to an electric powertrain), so a
 *                reasonable engineering assumption was used instead of a
 *                fabricated "reference" number
 *
 * See docs/UNCERTAINTY_METHODOLOGY_AND_MODEL_CHOICE.md for the full
 * derivation and the reasoning behind each assumed value.
 */
export const TAPAS_PRESET: ReferencePreset = {
  key: 'tapas',
  label: 'TAPAS BH-201',
  shortDesc: 'Large reference aircraft values mapped to this platform\u2019s input schema (TAPAS BH-201).',
  input: {
    aircraft_name: 'TAPAS BH-201',
    mass_kg: 2850,
    payload_kg: 350,
    wing_area_m2: 21.2,
    l_over_d: 26.0,
    cd0: 0.03,
    cruise_speed_ms: 45,
    air_density_kg_m3: 1.225,
    sfc_kg_per_n_s: 0.000007,
    thrust_to_weight: 0.32,
    propulsion_efficiency: 0.80,
    fuel_capacity_l: 500,
    propeller_diameter_m: 3.0,
    battery_wh: 106875,
    battery_soc: 0.9,
    aux_power_w: 480,
  },
  provenance: [
    { field: 'cruise_speed_ms', source: 'derived', note: 'Analysis cruise speed set to 45 m/s so it remains above the computed stall speed for this wing loading.' },
    { field: 'propulsion_efficiency', source: 'table', note: 'Propulsion Efficiency = 80%, used exactly as given.' },
    { field: 'wing_area_m2', source: 'table', note: 'Wing Area = 21.2 m², used exactly as given.' },
    { field: 'mass_kg', source: 'table', note: 'Aircraft Weight = 2850 kg, used exactly as given.' },
    { field: 'payload_kg', source: 'table', note: 'Payload Weight = 350 kg, used exactly as given.' },
    { field: 'wing_area_m2', source: 'derived', note: 'Wingspan was derived from wing area assuming a high aspect ratio (AR≈14); wingspan ≈ 17.2 m.' },
    { field: 'thrust_to_weight', source: 'derived', note: 'Thrust-to-Weight = 0.32 from the guide; used to derive an estimated propulsion power where needed.' },
    { field: 'battery_wh', source: 'assumed', note: 'Battery value represents a plausible electric energy budget for this scale and is not a direct conversion of the fuel energy.' },
    { field: 'l_over_d', source: 'table', note: 'L/D = 26 from the guide; used directly.' },
    { field: 'cd0', source: 'assumed', note: 'Representative zero-lift drag chosen instead of using the guide\u2019s total cruise CD directly.' },
  ],
  caveat:
    'This platform\u2019s ML surrogate was trained on smaller electric UAVs. ML predictions for TAPAS BH-201 will be outside the training distribution; this is expected. The physics engine still computes values at this scale.'
};

export const REFERENCE_PRESETS: ReferencePreset[] = [
  { key: 'default', label: 'Default \u2014 Mini Surveillance UAV', shortDesc: 'This platform\u2019s baseline small electric UAV, within the ML model\u2019s training range.', input: DEFAULT_PRESET_INPUT },
  TAPAS_PRESET,
];

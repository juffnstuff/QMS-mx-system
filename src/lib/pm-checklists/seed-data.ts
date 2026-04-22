// PM Checklist seed data — templates + items + equipment assignments.
// Sourced from F-19 Daily/Weekly/Monthly PM Form drafts + P-19 procedure.
//
// Layering rule (per Option A): weekly templates include all daily items + weekly-only;
// monthly templates include daily + weekly + monthly-only. Supersede relationships mirror
// the layering so completing a higher-frequency checklist satisfies lower-frequency ones
// for the same equipment on the same day.

export type InputType = "checkbox" | "numeric" | "text";
export type Frequency = "daily" | "weekly" | "monthly" | "quarterly";

export interface ItemSeed {
  label: string;
  details?: string;
  section?: string;
  inputType?: InputType;
  isCritical?: boolean;
  escalationNote?: string;
}

export interface TemplateSeed {
  code: string;
  name: string;
  frequency: Frequency;
  scope: string;
  description?: string;
  supersedesCodes?: string[];
  items: ItemSeed[];
}

// ============================================================================
// ITEM POOLS — defined once, composed into templates below.
// ============================================================================

// Daily — ALL PRESSES (from F-19 Daily §1.2)
const DAILY_ALL_PRESS_ITEMS: ItemSeed[] = [
  {
    section: "All Presses — Daily",
    label: "Hydraulic oil level",
    details: "Record actual sight glass / dipstick reading.",
    inputType: "numeric",
    isCritical: true,
    escalationNote: "Oil below minimum on a Class A press — lock out the press, halt production, notify supervisor. Open a WO. No restart until oil topped and cause identified.",
  },
  {
    section: "All Presses — Daily",
    label: "Visual leak check",
    details: "Hoses, fittings, manifolds, ram seals, floor below press.",
  },
  {
    section: "All Presses — Daily",
    label: "Oil condition",
    details: "Check for darkening (oxidation), foam (aeration), milky appearance (water ingress).",
  },
  {
    section: "All Presses — Daily",
    label: "Pressure gauge at idle",
    details: "Compare to posted normal operating range.",
  },
  {
    section: "All Presses — Daily",
    label: "Pump noise on startup",
    details: "Listen for cavitation, whine, grinding.",
    isCritical: true,
    escalationNote: "Cavitation noise on pump — lock out press, do not run. Maintenance inspection within 2 hours. Open a WO.",
  },
  {
    section: "All Presses — Daily",
    label: "Pressure gauge under load",
    details: "Compare to posted spec.",
  },
  {
    section: "All Presses — Daily",
    label: "Slow pressure decay after cycle",
    details: "Ram drift = seal issue.",
  },
  {
    section: "All Presses — Daily",
    label: "Control panel / PLC",
    details: "No warning lights or fault indicators.",
  },
  {
    section: "All Presses — Daily",
    label: "Area clean",
    details: "No oil accumulation on floor or press base.",
  },
  {
    section: "All Presses — Daily",
    label: "Emergency stop verified functional",
    details: "Test weekly minimum.",
  },
];

// Daily add-ons — LARGE PRESSES (shared plenum, F-19 Daily §1.3)
const DAILY_LARGE_PLENUM_ITEMS: ItemSeed[] = [
  {
    section: "Large Press — Shared Plenum Daily",
    label: "Shared plenum oil level",
    details: "Log ONCE per shift; document actual level for BOTH presses.",
    inputType: "numeric",
    isCritical: true,
    escalationNote: "Shared plenum oil low — lock out BOTH large presses simultaneously. Notify VP Operations. Root cause documented before restart.",
  },
  {
    section: "Large Press — Shared Plenum Daily",
    label: "Pump inlet line",
    details: "No weeping or air entrainment signs.",
  },
  {
    section: "Large Press — Shared Plenum Daily",
    label: "Return-line temperature by hand",
    details: "Hot = restriction or bypass issue.",
  },
  {
    section: "Large Press — Shared Plenum Daily",
    label: "Motor amps",
    details: "Quick glance vs normal baseline.",
    inputType: "numeric",
  },
];

// Daily add-ons — SMALL PRESSES (independent plenum, F-19 Daily §1.4)
const DAILY_SMALL_PLENUM_ITEMS: ItemSeed[] = [
  {
    section: "Small Press — Independent Plenum Daily",
    label: "Plenum oil level",
    details: "Record actual reading (independent; does not share).",
    inputType: "numeric",
    isCritical: true,
    escalationNote: "Oil below minimum on a Class A press — lock out the press, halt production, notify supervisor. Open a WO.",
  },
  {
    section: "Small Press — Independent Plenum Daily",
    label: "Motor amps",
    details: "Clamp meter check vs normal baseline.",
    inputType: "numeric",
  },
  {
    section: "Small Press — Independent Plenum Daily",
    label: "Pump noise on motor",
    details: "Cavitation or bearing noise on this unit's motor.",
    isCritical: true,
    escalationNote: "Cavitation noise on pump — lock out press, do not run. Maintenance inspection within 2 hours. Open a WO.",
  },
];

// Daily add-ons — DAKE 300T (F-19 Daily §1.5)
const DAILY_DAKE_ITEMS: ItemSeed[] = [
  {
    section: "Dake 300T — Daily",
    label: "Oil level — old tank close-check",
    details: "Old tank; notorious for slow leaks; check more closely than usual.",
    inputType: "numeric",
    isCritical: true,
    escalationNote: "Oil below minimum on a Class A press — lock out the press, halt production, notify supervisor. Open a WO.",
  },
  {
    section: "Dake 300T — Daily",
    label: "Ram seal seepage",
    details: "Wipe rod; mark any fresh weeping with marker.",
  },
  {
    section: "Dake 300T — Daily",
    label: "Pump noise on cold startup",
    details: "Cavitation signs indicate low oil or wear.",
    isCritical: true,
    escalationNote: "Cavitation noise on pump — lock out press, do not run. Maintenance inspection within 2 hours. Open a WO.",
  },
  {
    section: "Dake 300T — Daily",
    label: "Relief valve",
    details: "Not tampered with or bypassed.",
  },
];

// Weekly-only — ALL PRESSES (F-19 Weekly §1.1, new vs daily)
const WEEKLY_ALL_PRESS_ITEMS: ItemSeed[] = [
  {
    section: "All Presses — Weekly",
    label: "Tighten visible hose fittings",
    details: "Apply witness marks after tightening.",
  },
  {
    section: "All Presses — Weekly",
    label: "Inspect ram rods",
    details: "Scoring, pitting, or chrome damage.",
  },
  {
    section: "All Presses — Weekly",
    label: "Check hose abrasion points",
    details: "Rubber-on-metal frame contact.",
  },
  {
    section: "All Presses — Weekly",
    label: "Filter ΔP gauge / spin-on filter visual",
    details: "Inspect for restriction indicators.",
  },
  {
    section: "All Presses — Weekly",
    label: "Inspect breather caps",
    details: "Clean or replace if plugged.",
  },
  {
    section: "All Presses — Weekly",
    label: "Verify pressure relief valve",
    details: "Not tampered with, seated properly.",
  },
  {
    section: "All Presses — Weekly",
    label: "Log oil tank temperature during production",
    details: "Record reading.",
    inputType: "numeric",
  },
  {
    section: "All Presses — Weekly",
    label: "Inspect pump coupling",
    details: "Wear or misalignment signs.",
  },
  {
    section: "All Presses — Weekly",
    label: "Clean around platen interfaces and press frame",
  },
];

// Weekly add-ons — LARGE PRESSES (F-19 Weekly §5.2)
const WEEKLY_LARGE_PLENUM_ITEMS: ItemSeed[] = [
  {
    section: "Large Press — Shared Plenum Weekly",
    label: "Inspect suction strainer access",
    details: "No restriction signs.",
  },
  {
    section: "Large Press — Shared Plenum Weekly",
    label: "Inspect return manifold",
    details: "Vibration cracks at weld joints.",
  },
  {
    section: "Large Press — Shared Plenum Weekly",
    label: "Pump coupling inspection (both presses)",
    details: "Wear and alignment — check each press.",
  },
  {
    section: "Large Press — Shared Plenum Weekly",
    label: "Motor bearing temperature",
    details: "Compare Press #1 vs Press #2.",
    inputType: "numeric",
  },
];

// Monthly-only — ALL PRESSES (F-19 Monthly §1.2, new vs daily + weekly)
const MONTHLY_ALL_PRESS_ITEMS: ItemSeed[] = [
  {
    section: "All Presses — Monthly",
    label: "Hydraulic oil sample",
    details: "Bottle and label; send quarterly to lab.",
  },
  {
    section: "All Presses — Monthly",
    label: "Inspect relief valves",
    details: "Reseat if required.",
  },
  {
    section: "All Presses — Monthly",
    label: "Inspect pump coupling (replace if worn)",
    details: "Beyond weekly inspection — replace worn couplings.",
  },
  {
    section: "All Presses — Monthly",
    label: "Inspect platen alignment indicators",
    details: "If present on this press.",
  },
  {
    section: "All Presses — Monthly",
    label: "Inspect electrical terminations in control cabinet",
  },
  {
    section: "All Presses — Monthly",
    label: "Verify pressure transducer vs mechanical gauge",
    details: "Cross-check readings.",
  },
  {
    section: "All Presses — Monthly",
    label: "Inspect all hydraulic hoses",
    details: "Flag any over 5 years old.",
  },
  {
    section: "All Presses — Monthly",
    label: "Log all ram seal conditions",
    details: "Grade each: Good / Watch / Replace.",
    inputType: "text",
  },
  {
    section: "All Presses — Monthly",
    label: "Photograph any new leaks, scoring, or damage",
    details: "Attach photos to this completion.",
  },
  {
    section: "All Presses — Monthly",
    label: "Log total run hours if hour meter present",
    inputType: "numeric",
  },
];

// Quarterly / semi-annual — ALL PRESSES (F-19 Monthly §6.2)
const QUARTERLY_PRESS_ITEMS: ItemSeed[] = [
  {
    section: "All Presses — Quarterly / Semi-Annual",
    label: "Hydraulic oil analysis",
    details: "ISO cleanliness, TAN, water content.",
  },
  {
    section: "All Presses — Quarterly / Semi-Annual",
    label: "Filter cartridge replacement",
    details: "Regardless of appearance.",
  },
  {
    section: "All Presses — Quarterly / Semi-Annual",
    label: "Relief valve test and reseat",
  },
  {
    section: "All Presses — Quarterly / Semi-Annual",
    label: "Electrical IR scan",
    details: "If infrared scan capability is available.",
  },
  {
    section: "All Presses — Quarterly / Semi-Annual",
    label: "Ram seal condition assessment",
    details: "Replace any flagged from monthly log.",
  },
  {
    section: "All Presses — Quarterly / Semi-Annual",
    label: "Full hose inspection",
    details: "Replace any flagged as age risk.",
  },
];

// Daily — HOT OIL BOILER (F-19 Daily §2.0)
const DAILY_BOILER_ITEMS: ItemSeed[] = [
  {
    section: "Hot Oil Boiler — Daily",
    label: "Oil level",
    details: "Expansion tank sight glass reading.",
    inputType: "numeric",
  },
  {
    section: "Hot Oil Boiler — Daily",
    label: "Supply temperature",
    details: "Log setpoint vs actual.",
    inputType: "numeric",
  },
  {
    section: "Hot Oil Boiler — Daily",
    label: "Return temperature",
    details: "Log and compare to supply delta.",
    inputType: "numeric",
  },
  {
    section: "Hot Oil Boiler — Daily",
    label: "Pump noise",
    details: "Cavitation or seal leak sounds.",
  },
  {
    section: "Hot Oil Boiler — Daily",
    label: "Visual leak check",
    details: "Fittings, flanges, pump seal, boiler jacket.",
  },
  {
    section: "Hot Oil Boiler — Daily",
    label: "Burner ignition normal",
    details: "No delayed ignition or misfires.",
  },
  {
    section: "Hot Oil Boiler — Daily",
    label: "Safety interlock indicators",
    details: "No fault lights.",
  },
  {
    section: "Hot Oil Boiler — Daily",
    label: "Smell check — burning oil odor",
    details: "Burning oil odor = immediate shutdown and lockout.",
    isCritical: true,
    escalationNote: "Burning oil smell on hot oil boiler — immediate shutdown and lockout. Do not restart without authorization from maintenance manager and VP Operations.",
  },
];

// Daily — AIR COMPRESSORS (F-19 Daily §3.0, operator-daily only per Atlas Copco contract)
const DAILY_COMPRESSOR_ITEMS: ItemSeed[] = [
  {
    section: "Air Compressor — Daily (Operator)",
    label: "Oil level",
    details: "Dipstick reading; log actual.",
    inputType: "numeric",
  },
  {
    section: "Air Compressor — Daily (Operator)",
    label: "Drain condensate",
    details: "From tank and dryer.",
  },
  {
    section: "Air Compressor — Daily (Operator)",
    label: "Listen for abnormal sounds",
    details: "Knocking, air leaks, bearing noise.",
  },
  {
    section: "Air Compressor — Daily (Operator)",
    label: "Pressure relief valve",
    details: "No weeping at seat.",
  },
  {
    section: "Air Compressor — Daily (Operator)",
    label: "Outlet air pressure",
    details: "Meets plant system requirements.",
    inputType: "numeric",
  },
  {
    section: "Air Compressor — Daily (Operator)",
    label: "Dryer / separator alarm indicators",
    details: "No alarms on SMARTLINK or panel.",
  },
  {
    section: "Air Compressor — Daily (Operator)",
    label: "Temperatures and pressures within normal range",
  },
  {
    section: "Air Compressor — Daily (Operator)",
    label: "SMARTLINK connected",
    details: "Verify unit shows online in controller.",
    isCritical: true,
    escalationNote: "SMARTLINK disconnected — reconnect immediately. Notify Atlas Copco if not resolved within 24 hrs. Customer is responsible for keeping SMARTLINK connected per service agreement.",
  },
];

// ============================================================================
// TEMPLATES — composed by layering the item pools.
// ============================================================================

export const TEMPLATES: TemplateSeed[] = [
  // ---- Dake 300T ----
  {
    code: "DAILY_DAKE_300T",
    name: "Daily PM — Dake 300T",
    frequency: "daily",
    scope: "dake_300t",
    description: "Daily PM for the Dake 300T single-ram press (RF-EQ-001). Covers all-press daily checks + Dake-specific additions.",
    items: [...DAILY_ALL_PRESS_ITEMS, ...DAILY_DAKE_ITEMS],
  },
  {
    code: "WEEKLY_DAKE_300T",
    name: "Weekly PM — Dake 300T",
    frequency: "weekly",
    scope: "dake_300t",
    supersedesCodes: ["DAILY_DAKE_300T"],
    description: "Weekly PM for Dake 300T. Superset of daily + weekly press items.",
    items: [...DAILY_ALL_PRESS_ITEMS, ...DAILY_DAKE_ITEMS, ...WEEKLY_ALL_PRESS_ITEMS],
  },
  {
    code: "MONTHLY_DAKE_300T",
    name: "Monthly PM — Dake 300T",
    frequency: "monthly",
    scope: "dake_300t",
    supersedesCodes: ["DAILY_DAKE_300T", "WEEKLY_DAKE_300T"],
    description: "Monthly PM for Dake 300T. Superset of daily + weekly + monthly items.",
    items: [...DAILY_ALL_PRESS_ITEMS, ...DAILY_DAKE_ITEMS, ...WEEKLY_ALL_PRESS_ITEMS, ...MONTHLY_ALL_PRESS_ITEMS],
  },

  // ---- Large Press (shared plenum: RF-EQ-002, 003) ----
  {
    code: "DAILY_LARGE_PRESS",
    name: "Daily PM — Large Press (9-Ram)",
    frequency: "daily",
    scope: "large_plenum",
    description: "Daily PM for Large Presses 1 & 2 (RF-EQ-002/003). All-press checks + shared plenum additions.",
    items: [...DAILY_ALL_PRESS_ITEMS, ...DAILY_LARGE_PLENUM_ITEMS],
  },
  {
    code: "WEEKLY_LARGE_PRESS",
    name: "Weekly PM — Large Press (9-Ram)",
    frequency: "weekly",
    scope: "large_plenum",
    supersedesCodes: ["DAILY_LARGE_PRESS"],
    description: "Weekly PM for Large Presses. Superset of daily + weekly all-press + shared-plenum weekly items.",
    items: [
      ...DAILY_ALL_PRESS_ITEMS,
      ...DAILY_LARGE_PLENUM_ITEMS,
      ...WEEKLY_ALL_PRESS_ITEMS,
      ...WEEKLY_LARGE_PLENUM_ITEMS,
    ],
  },
  {
    code: "MONTHLY_LARGE_PRESS",
    name: "Monthly PM — Large Press (9-Ram)",
    frequency: "monthly",
    scope: "large_plenum",
    supersedesCodes: ["DAILY_LARGE_PRESS", "WEEKLY_LARGE_PRESS"],
    description: "Monthly PM for Large Presses. Full superset.",
    items: [
      ...DAILY_ALL_PRESS_ITEMS,
      ...DAILY_LARGE_PLENUM_ITEMS,
      ...WEEKLY_ALL_PRESS_ITEMS,
      ...WEEKLY_LARGE_PLENUM_ITEMS,
      ...MONTHLY_ALL_PRESS_ITEMS,
    ],
  },

  // ---- Small Press (independent plenum: RF-EQ-004, 005) ----
  {
    code: "DAILY_SMALL_PRESS",
    name: "Daily PM — Small Press (5-Ram)",
    frequency: "daily",
    scope: "small_plenum",
    description: "Daily PM for Small Presses 1 & 2 (RF-EQ-004/005). All-press checks + independent plenum items.",
    items: [...DAILY_ALL_PRESS_ITEMS, ...DAILY_SMALL_PLENUM_ITEMS],
  },
  {
    code: "WEEKLY_SMALL_PRESS",
    name: "Weekly PM — Small Press (5-Ram)",
    frequency: "weekly",
    scope: "small_plenum",
    supersedesCodes: ["DAILY_SMALL_PRESS"],
    description: "Weekly PM for Small Presses. Superset of daily + weekly press items.",
    items: [...DAILY_ALL_PRESS_ITEMS, ...DAILY_SMALL_PLENUM_ITEMS, ...WEEKLY_ALL_PRESS_ITEMS],
  },
  {
    code: "MONTHLY_SMALL_PRESS",
    name: "Monthly PM — Small Press (5-Ram)",
    frequency: "monthly",
    scope: "small_plenum",
    supersedesCodes: ["DAILY_SMALL_PRESS", "WEEKLY_SMALL_PRESS"],
    description: "Monthly PM for Small Presses. Full superset.",
    items: [
      ...DAILY_ALL_PRESS_ITEMS,
      ...DAILY_SMALL_PLENUM_ITEMS,
      ...WEEKLY_ALL_PRESS_ITEMS,
      ...MONTHLY_ALL_PRESS_ITEMS,
    ],
  },

  // ---- Quarterly press PM (applies to every press) ----
  {
    code: "QUARTERLY_PRESS",
    name: "Quarterly PM — Press",
    frequency: "quarterly",
    scope: "all_presses",
    description: "Quarterly / semi-annual PM for any Class A press. Scheduled by VP Operations per P-19.",
    items: QUARTERLY_PRESS_ITEMS,
  },

  // ---- Hot oil boiler ----
  {
    code: "DAILY_HOT_OIL_BOILER",
    name: "Daily PM — Hot Oil Boiler",
    frequency: "daily",
    scope: "hot_oil_boiler",
    description: "Daily operator checks for the hot oil boiler (RF-EQ-006).",
    items: DAILY_BOILER_ITEMS,
  },

  // ---- Air compressors ----
  {
    code: "DAILY_COMPRESSOR",
    name: "Daily PM — Air Compressor (Operator)",
    frequency: "daily",
    scope: "compressor",
    description: "Operator daily checks for Atlas Copco compressors (RF-EQ-013/014). Full PM is vendor-managed by Atlas Copco; daily/weekly operator checks are a customer obligation.",
    items: DAILY_COMPRESSOR_ITEMS,
  },
];

// ============================================================================
// EQUIPMENT → TEMPLATES mapping. Keyed by Equipment.serialNumber.
// If the equipment doesn't exist, the seed will create a minimal stub row.
// ============================================================================

export interface EquipmentSeed {
  serialNumber: string;
  name: string;
  type: string;
  location: string;
  criticality: string;
  equipmentClass: string;
  groupName?: string;
  templateCodes: string[];
}

export const EQUIPMENT_TEMPLATE_MAP: EquipmentSeed[] = [
  {
    serialNumber: "RF-EQ-001",
    name: "Dake 300T Single-Ram Press",
    type: "Press",
    location: "Bay 1",
    criticality: "A",
    equipmentClass: "presses",
    groupName: "Dake Press System",
    templateCodes: ["DAILY_DAKE_300T", "WEEKLY_DAKE_300T", "MONTHLY_DAKE_300T", "QUARTERLY_PRESS"],
  },
  {
    serialNumber: "RF-EQ-002",
    name: "Large Press #1 – 9-Ram",
    type: "Press",
    location: "Bay 2",
    criticality: "A",
    equipmentClass: "presses",
    groupName: "Large Press System (Shared Plenum)",
    templateCodes: ["DAILY_LARGE_PRESS", "WEEKLY_LARGE_PRESS", "MONTHLY_LARGE_PRESS", "QUARTERLY_PRESS"],
  },
  {
    serialNumber: "RF-EQ-003",
    name: "Large Press #2 – 9-Ram",
    type: "Press",
    location: "Bay 2",
    criticality: "A",
    equipmentClass: "presses",
    groupName: "Large Press System (Shared Plenum)",
    templateCodes: ["DAILY_LARGE_PRESS", "WEEKLY_LARGE_PRESS", "MONTHLY_LARGE_PRESS", "QUARTERLY_PRESS"],
  },
  {
    serialNumber: "RF-EQ-004",
    name: "Small Press #1 – 5-Ram",
    type: "Press",
    location: "Bay 3",
    criticality: "A",
    equipmentClass: "presses",
    groupName: "Small Press System",
    templateCodes: ["DAILY_SMALL_PRESS", "WEEKLY_SMALL_PRESS", "MONTHLY_SMALL_PRESS", "QUARTERLY_PRESS"],
  },
  {
    serialNumber: "RF-EQ-005",
    name: "Small Press #2 – 5-Ram",
    type: "Press",
    location: "Bay 3",
    criticality: "A",
    equipmentClass: "presses",
    groupName: "Small Press System",
    templateCodes: ["DAILY_SMALL_PRESS", "WEEKLY_SMALL_PRESS", "MONTHLY_SMALL_PRESS", "QUARTERLY_PRESS"],
  },
  {
    serialNumber: "RF-EQ-006",
    name: "Hot Oil Boiler (Process)",
    type: "Boiler",
    location: "Utility Room",
    criticality: "A",
    equipmentClass: "utilities",
    templateCodes: ["DAILY_HOT_OIL_BOILER"],
  },
  {
    serialNumber: "RF-EQ-013",
    name: "Air Compressor – Atlas Copco GA11VSD+FF",
    type: "Compressor",
    location: "Utility Room",
    criticality: "A",
    equipmentClass: "utilities",
    templateCodes: ["DAILY_COMPRESSOR"],
  },
  {
    serialNumber: "RF-EQ-014",
    name: "Air Compressor – Atlas Copco GA15VSDs 10bar FF",
    type: "Compressor",
    location: "Utility Room",
    criticality: "A",
    equipmentClass: "utilities",
    templateCodes: ["DAILY_COMPRESSOR"],
  },
];

// Default technician assignment by equipment class — looked up by first name.
// Only applied when the equipment has no assigned technician yet (placeholder;
// can be reassigned on the equipment detail page).
export const DEFAULT_TECHNICIAN_BY_CLASS: Record<string, string> = {
  presses: "Anthony", // Compression molding
  extruders: "Joe", // Extrusion line
};


import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { accessNCRs } from "../src/data/access-import/ncrs";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // NCRs need an authoring user. The seed no longer creates users — it relies
  // on a real admin account having been created through the UI first.
  const admin = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    throw new Error(
      "No admin user found. Create an admin through the Users page before running the seed.",
    );
  }

  // Delete existing records to avoid duplicates on re-seed
  await prisma.maintenanceSchedule.deleteMany();
  await prisma.maintenanceLog.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.equipment.deleteMany();

  // ==========================================================================
  // EQUIPMENT REGISTER — 69 items from RubberForm_PM_System_v6.xlsx
  // ==========================================================================

  const equipmentData: {
    serialNumber: string;
    name: string;
    type: string;
    location: string;
    status: string;
    notes: string | null;
  }[] = [
    // --- Presses ---
    { serialNumber: "RF-EQ-001", name: "Dake 300T Single-Ram Press", type: "Press", location: "Bay 1", status: "operational", notes: "OMS-1 | Stand-alone hydraulic; single ram | ~1965 Dake 300T" },
    { serialNumber: "RF-EQ-002", name: "Large Press #1 – 9-Ram", type: "Press", location: "Bay 2", status: "operational", notes: "OMS-45 (Press 1) | Shared plenum & motor w/ Press #2 | Custom 9-Ram" },
    { serialNumber: "RF-EQ-003", name: "Large Press #2 – 9-Ram", type: "Press", location: "Bay 2", status: "operational", notes: "OMS-44 (Press 2) | Shared plenum & motor w/ Press #1 | Custom 9-Ram" },
    { serialNumber: "RF-EQ-004", name: "Small Press #1 – 5-Ram", type: "Press", location: "Bay 3", status: "operational", notes: "OMS-4 (Press 3) | Independent plenum | Custom 5-Ram" },
    { serialNumber: "RF-EQ-005", name: "Small Press #2 – 5-Ram", type: "Press", location: "Bay 3", status: "operational", notes: "OMS-2 (Press 4) | Independent plenum | Custom 5-Ram" },
    { serialNumber: "RF-EQ-046", name: "Die Cutting Press", type: "Press", location: "Production Floor", status: "operational", notes: "OMS-23 | Electric / Hydraulic | Criticality A" },

    // --- Boilers ---
    { serialNumber: "RF-EQ-006", name: "Hot Oil Boiler (Process)", type: "Boiler", location: "Utility Room", status: "operational", notes: "Feeds compression mold heat | Gas / Electric | Criticality A" },
    { serialNumber: "RF-EQ-021", name: "Gas Fired Boiler – Heatec HCS-250/H06-141", type: "Boiler", location: "Utility / Mechanical Room", status: "operational", notes: "EMCOR agreement 7/10 | Class A — building heat loss if down | Natural Gas | Heatec HCS-250/H06-141" },

    // --- Furnace ---
    { serialNumber: "RF-EQ-007", name: "Furnace / Oven #1", type: "Furnace", location: "Bay 1", status: "operational", notes: "Electric | Criticality A" },

    // --- Forklifts (JIT Toyota-Lift PM vendor) ---
    { serialNumber: "RF-EQ-008", name: "Forklift – Toyota 8FGCU25 #1", type: "Forklift", location: "Warehouse", status: "operational", notes: "OMS-14 | Toyota 8FGCU25COMP S/N 73974 | Battery | JIT $125/PM 180-day | Last PM 7/16/2025 | Next PM 1/12/2026" },
    { serialNumber: "RF-EQ-009", name: "Forklift – Toyota 8FGCU25 #2", type: "Forklift", location: "Warehouse", status: "operational", notes: "OMS-15 | Toyota 8FGCU25COMP S/N 85624 | Battery | JIT $125/PM 180-day" },
    { serialNumber: "RF-EQ-010", name: "Forklift – Hyster H150F", type: "Forklift", location: "Warehouse", status: "operational", notes: "OMS-16 | Hyster H150F S/N D006T015 | Propane | JIT $160/PM 180-day" },
    { serialNumber: "RF-EQ-011", name: "Forklift – Hyundai 25L-7A", type: "Forklift", location: "Warehouse", status: "operational", notes: "OMS-17 | Hyundai 25L-7A S/N HHKHHF08CF0005999 | Propane | JIT $135/PM 180-day" },
    { serialNumber: "RF-EQ-012", name: "Forklift – Hyster N35ZRS3 (Reach Truck)", type: "Forklift", location: "Warehouse", status: "operational", notes: "Narrow-aisle reach truck | Hyster N35ZRS3-14.25 S/N C265N02077X | Battery | JIT $150/PM 180-day | Not in OMS" },

    // --- Compressors (Atlas Copco PM vendor) ---
    { serialNumber: "RF-EQ-013", name: "Air Compressor – Atlas Copco GA11VSD+FF", type: "Compressor", location: "Utility Room", status: "operational", notes: "Atlas Copco GA11VSD+FF S/N API268155 | PM $2,573.29/yr | RotoXtend oil | SMARTLINK Uptime | Quote 158395228" },
    { serialNumber: "RF-EQ-014", name: "Air Compressor – Atlas Copco GA15VSDs 10bar FF", type: "Compressor", location: "Utility Room", status: "operational", notes: "Atlas Copco GA15VSDs 10bar FF S/N ITJ802935 | PM $2,693.10/yr | RotoXtend oil | SMARTLINK Uptime | Quote 158395228" },

    // --- HVAC / Heating (EMCOR Betlem PM vendor, 10 units quarterly) ---
    { serialNumber: "RF-EQ-015", name: "Make Up Air Unit – Cambridge Warehouse Heat", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 1/10 | Cambridge MUA | Natural Gas | Mike Zimmerman 585-271-5500" },
    { serialNumber: "RF-EQ-016", name: "Infrared Tube Heater #1", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 2/10 | Natural Gas | Tag & add serial/location" },
    { serialNumber: "RF-EQ-017", name: "Infrared Tube Heater #2", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 3/10 | Natural Gas" },
    { serialNumber: "RF-EQ-018", name: "Infrared Tube Heater #3", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 4/10 | Natural Gas" },
    { serialNumber: "RF-EQ-019", name: "Infrared Tube Heater #4", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 5/10 | Natural Gas" },
    { serialNumber: "RF-EQ-020", name: "Infrared Tube Heater #5", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 6/10 | Natural Gas" },
    { serialNumber: "RF-EQ-022", name: "Split System DX #1 – Office Heat/Cool", type: "HVAC", location: "Office Area", status: "operational", notes: "EMCOR agreement 8/10 | Electric / Refrigerant" },
    { serialNumber: "RF-EQ-023", name: "Split System DX #2 – Office Heat/Cool", type: "HVAC", location: "Office Area", status: "operational", notes: "EMCOR agreement 9/10 | Electric / Refrigerant" },
    { serialNumber: "RF-EQ-024", name: "Split System DX #3 – Office Heat/Cool", type: "HVAC", location: "Office Area", status: "operational", notes: "EMCOR agreement 10/10 | Electric / Refrigerant" },

    // --- Power Tools ---
    { serialNumber: "RF-EQ-025", name: "Angle Grinders (group)", type: "Power Tool", location: "Tool Room", status: "operational", notes: "Group entry | Various manufacturers | Electric | Criticality C" },
    { serialNumber: "RF-EQ-026", name: "Large Drill Press", type: "Power Tool", location: "Machine Shop", status: "operational", notes: "OMS-9 | Electric | Criticality C" },
    { serialNumber: "RF-EQ-027", name: "Horizontal Band Saw", type: "Power Tool", location: "Machine Shop", status: "operational", notes: "OMS-8 | Electric | Criticality C" },
    { serialNumber: "RF-EQ-053", name: "Nova Drill Press #1", type: "Power Tool", location: "Machine Shop", status: "operational", notes: "OMS-10 | Nova | Electric | Criticality C" },
    { serialNumber: "RF-EQ-054", name: "Nova Drill Press #2", type: "Power Tool", location: "Machine Shop (Bay 3)", status: "operational", notes: "OMS-11 | Nova | Electric | Criticality C" },
    { serialNumber: "RF-EQ-055", name: "4-Head Drill Press", type: "Power Tool", location: "Machine Shop", status: "operational", notes: "OMS-36 | Electric | Criticality C" },
    { serialNumber: "RF-EQ-056", name: "Collar Drill Press", type: "Power Tool", location: "Machine Shop", status: "operational", notes: "OMS-37 | Electric | Criticality C" },
    { serialNumber: "RF-EQ-057", name: "Cable Support Drilling Machine", type: "Power Tool", location: "Machine Shop", status: "operational", notes: "OMS-34 | Electric | Criticality C" },
    { serialNumber: "RF-EQ-058", name: "Paver Drilling Table", type: "Power Tool", location: "Machine Shop", status: "operational", notes: "OMS-35 | Electric | Criticality C" },
    { serialNumber: "RF-EQ-059", name: "Vertical Band Saw", type: "Power Tool", location: "Machine Shop", status: "operational", notes: "OMS-22 | Electric | Criticality C" },
    { serialNumber: "RF-EQ-060", name: "Band Chop Saw", type: "Power Tool", location: "Machine Shop", status: "operational", notes: "OMS-32 | Electric | Criticality C" },

    // --- Welders ---
    { serialNumber: "RF-EQ-028", name: "Welders (group)", type: "Welder", location: "Fab Area", status: "operational", notes: "Group entry — see RF-EQ-061 for specific MIG | Electric | Criticality C" },
    { serialNumber: "RF-EQ-061", name: "MIG Welder", type: "Welder", location: "Fab Area (Bay 2)", status: "operational", notes: "OMS-21 | Specific unit | Electric | Criticality C" },

    // --- Material Handling ---
    { serialNumber: "RF-EQ-029", name: "Pallet Jacks (group)", type: "Material Handling", location: "Warehouse", status: "operational", notes: "Group entry | Various | Manual | Criticality C" },
    { serialNumber: "RF-EQ-063", name: "Scissor Lift", type: "Material Handling", location: "Warehouse (Bay 2)", status: "operational", notes: "OMS-13 | Inspection per OSHA 1910.178 | Electric | Criticality B" },

    // --- Reserved ---
    { serialNumber: "RF-EQ-030", name: "TBD – Reserved", type: "Reserved", location: "TBD", status: "needs_service", notes: "Reserved slot" },

    // --- Extruders ---
    { serialNumber: "RF-EQ-031", name: "4in Barrel Extruder", type: "Extruder", location: "Extrusion Bay", status: "operational", notes: "OMS-5 | 4in extrusion line | Electric / Hydraulic | Criticality A" },
    { serialNumber: "RF-EQ-035", name: "6in Extruder", type: "Extruder", location: "Extrusion Bay", status: "operational", notes: "OMS-40 | 6in extrusion line | Electric / Hydraulic | Criticality A" },

    // --- Extrusion Auxiliary ---
    { serialNumber: "RF-EQ-032", name: "4in Extrusion Puller", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-39 | 4in line | Electric | Criticality A" },
    { serialNumber: "RF-EQ-033", name: "4in Cooling Table", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-6 | 4in line | Electric / Water | Criticality B" },
    { serialNumber: "RF-EQ-034", name: "4in Extrusion Cross Saw", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-7 | 4in line | Electric | Criticality B" },
    { serialNumber: "RF-EQ-036", name: "6in Extrusion Puller", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-42 | 6in line | Electric | Criticality A" },
    { serialNumber: "RF-EQ-037", name: "6in Extrusion Cooling Table", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-41 | 6in line | Electric / Water | Criticality B" },
    { serialNumber: "RF-EQ-038", name: "6in Extrusion Cross Saw", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-43 | 6in line | Electric | Criticality B" },
    { serialNumber: "RF-EQ-048", name: "4in Bollard Cooling Rack", type: "Extrusion Aux", location: "Bay 19", status: "operational", notes: "OMS-49 | Label: BCR-4in | IQS 4inBCR-000 S/N 1 | Date in service: 2/6/2026" },
    { serialNumber: "RF-EQ-049", name: "7in Bollard Cooling Rack", type: "Extrusion Aux", location: "Bay 19", status: "operational", notes: "OMS-50 | Label: BCR-7in | IQS 7inBCR-000 S/N 1 | Date in service: 2/6/2026" },

    // --- Mixers ---
    { serialNumber: "RF-EQ-039", name: "Mixer #1 – Dake Area", type: "Mixer", location: "Bay 1 (Dake Area)", status: "operational", notes: "OMS-18 | Electric | Criticality A" },
    { serialNumber: "RF-EQ-040", name: "Mixer #2 – Isle", type: "Mixer", location: "Bay 2 (Isle)", status: "operational", notes: "OMS-19 | Electric | Criticality A" },
    { serialNumber: "RF-EQ-041", name: "Mixer #3 – ERC", type: "Mixer", location: "Bay 3 (ERC)", status: "operational", notes: "OMS-20 | Electric | Criticality A" },

    // --- Feed Systems ---
    { serialNumber: "RF-EQ-042", name: "Bulk Bag Hopper #1", type: "Feed System", location: "Production Floor", status: "operational", notes: "OMS-28 | Electric / Pneumatic | Criticality A" },
    { serialNumber: "RF-EQ-043", name: "Bulk Bag Hopper #2", type: "Feed System", location: "Production Floor", status: "operational", notes: "OMS-29 | Electric / Pneumatic | Criticality A" },
    { serialNumber: "RF-EQ-044", name: "M1 Screw Feeder", type: "Feed System", location: "Bay 1", status: "operational", notes: "OMS-30 | Feeds press(es) | Electric | Criticality A" },
    { serialNumber: "RF-EQ-045", name: "M2 Screw Feeder", type: "Feed System", location: "Bay 2", status: "operational", notes: "OMS-31 | Feeds press(es) | Electric | Criticality A" },

    // --- Specialty Machines ---
    { serialNumber: "RF-EQ-047", name: "Bollard Cutting Machine", type: "Specialty Machine", location: "Bay 19", status: "operational", notes: "OMS-48 | Label: BCM-1 | IQS BCM-000 S/N 1 | Date in service: 2/6/2026 | Pre Production Release | Criticality A" },
    { serialNumber: "RF-EQ-050", name: "CST Inner Pole Drilling Machine", type: "Specialty Machine", location: "Machine Shop (Bay 7)", status: "operational", notes: "OMS-51 | Label: CSTDM-1 | IQS CSTDM-000 S/N 1 | Production Release Gen3 | Criticality B" },
    { serialNumber: "RF-EQ-051", name: "CST Collar Drilling Machine", type: "Specialty Machine", location: "Machine Shop (Bay 7)", status: "operational", notes: "OMS-52 | Label: CSTDM-2 | IQS CDM-000 S/N 1 | Production Release Gen1 | Criticality B" },
    { serialNumber: "RF-EQ-052", name: "CST Rivet Drilling Machine", type: "Specialty Machine", location: "Machine Shop (Bay 7)", status: "operational", notes: "OMS-53 | Label: CSTDM-3 | IQS N/A S/N 1 | Production Release Gen1 | Criticality B" },

    // --- Machine Tool ---
    { serialNumber: "RF-EQ-062", name: "Kneemill", type: "Machine Tool", location: "Fab Area (Bay 2)", status: "operational", notes: "OMS-38 | Electric | Criticality C" },

    // --- Packaging ---
    { serialNumber: "RF-EQ-064", name: "Shrinkwrap Machine", type: "Packaging", location: "Shipping (Bay 1)", status: "operational", notes: "OMS-12 | Electric | Criticality C" },
    { serialNumber: "RF-EQ-066", name: "Auto Tape Dispenser", type: "Packaging", location: "Shipping (Bay 1)", status: "operational", notes: "OMS-25 | Electric | Criticality C" },

    // --- Measurement ---
    { serialNumber: "RF-EQ-065", name: "Pallet Scale", type: "Measurement", location: "Shipping (Bay 1)", status: "operational", notes: "OMS-24 | Calibration log required | Electric | Criticality C" },

    // --- Peripheral ---
    { serialNumber: "RF-EQ-067", name: "Thermal Printer", type: "Peripheral", location: "Machine Shop (Bay 7)", status: "operational", notes: "OMS-33 | Electric | Criticality C" },

    // --- Facility ---
    { serialNumber: "RF-EQ-068", name: "Loading Dock", type: "Facility", location: "Shipping (Bay 1)", status: "operational", notes: "OMS-26 | Dock leveler; safety critical for load operations | Electric / Hydraulic | Criticality B" },

    // --- Vehicle ---
    { serialNumber: "RF-EQ-069", name: "Ford F250", type: "Vehicle", location: "Parking / Field", status: "operational", notes: "OMS-27 | Company vehicle; standard OEM PM schedule | Gas | Criticality B" },
  ];

  const createdEquipment = await prisma.equipment.createMany({
    data: equipmentData,
  });
  console.log(`Created ${createdEquipment.count} equipment records`);

  // Auto-populate criticality from notes field
  const allEquipmentForCrit = await prisma.equipment.findMany({
    where: { notes: { not: null } },
    select: { id: true, notes: true },
  });
  let critUpdated = 0;
  for (const item of allEquipmentForCrit) {
    if (!item.notes) continue;
    const critMatch = item.notes.match(/Criticality\s+([ABC])/i);
    const classMatch = item.notes.match(/Class\s+([ABC])\b/i);
    const parsed = (critMatch?.[1] || classMatch?.[1])?.toUpperCase();
    if (parsed && ["A", "B", "C"].includes(parsed)) {
      await prisma.equipment.update({
        where: { id: item.id },
        data: { criticality: parsed },
      });
      critUpdated++;
    }
  }
  console.log(`Updated criticality for ${critUpdated} equipment from notes`);

  // Fetch all equipment keyed by serialNumber for schedule references
  const allEquipment = await prisma.equipment.findMany();
  const eqMap = new Map(allEquipment.map((e) => [e.serialNumber, e.id]));

  // ==========================================================================
  // MAINTENANCE SCHEDULES — from Equipment Register PM data
  // ==========================================================================

  const scheduleData: {
    equipmentId: string;
    title: string;
    description: string;
    frequency: string;
    lastDone: Date | null;
    nextDue: Date;
  }[] = [];

  // Helper to get equipment ID
  const eq = (serial: string) => eqMap.get(serial)!;

  // --- Class A Presses / Extruders / Mixers / Feed / Specialty: Daily/Weekly/Monthly ---
  const classADailyWeeklyMonthly = [
    "RF-EQ-001", "RF-EQ-002", "RF-EQ-003", "RF-EQ-004", "RF-EQ-005",
    "RF-EQ-006", "RF-EQ-031", "RF-EQ-035", "RF-EQ-046",
  ];
  for (const serial of classADailyWeeklyMonthly) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — Daily inspection`, description: "Daily visual and operational check per PM checklist", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
      { equipmentId: eq(serial), title: `${name} — Weekly PM`, description: "Weekly preventive maintenance per PM checklist", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
      { equipmentId: eq(serial), title: `${name} — Monthly PM`, description: "Monthly preventive maintenance per PM checklist", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
    );
  }

  // Furnace: Daily/Weekly
  scheduleData.push(
    { equipmentId: eq("RF-EQ-007"), title: "Furnace / Oven #1 — Daily inspection", description: "Daily operational check", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
    { equipmentId: eq("RF-EQ-007"), title: "Furnace / Oven #1 — Weekly PM", description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
  );

  // Mixers: Daily/Weekly
  for (const serial of ["RF-EQ-039", "RF-EQ-040", "RF-EQ-041"]) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — Daily inspection`, description: "Daily operational check", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
      { equipmentId: eq(serial), title: `${name} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
    );
  }

  // Feed systems: Daily/Weekly
  for (const serial of ["RF-EQ-042", "RF-EQ-043", "RF-EQ-044", "RF-EQ-045"]) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — Daily inspection`, description: "Daily operational check", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
      { equipmentId: eq(serial), title: `${name} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
    );
  }

  // Extrusion Aux (Pullers): Weekly/Monthly
  for (const serial of ["RF-EQ-032", "RF-EQ-036"]) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
      { equipmentId: eq(serial), title: `${name} — Monthly PM`, description: "Monthly preventive maintenance", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
    );
  }

  // Extrusion Aux (Cooling Tables, Cross Saws, Cooling Racks): Weekly/Monthly
  for (const serial of ["RF-EQ-033", "RF-EQ-034", "RF-EQ-037", "RF-EQ-038", "RF-EQ-048", "RF-EQ-049"]) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
      { equipmentId: eq(serial), title: `${name} — Monthly PM`, description: "Monthly preventive maintenance", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
    );
  }

  // Bollard Cutting Machine: Daily/Weekly/Monthly
  scheduleData.push(
    { equipmentId: eq("RF-EQ-047"), title: "Bollard Cutting Machine — Daily inspection", description: "Daily operational check", frequency: "daily", lastDone: new Date("2025-12-12"), nextDue: new Date("2026-04-13") },
    { equipmentId: eq("RF-EQ-047"), title: "Bollard Cutting Machine — Weekly PM", description: "Weekly preventive maintenance", frequency: "weekly", lastDone: new Date("2025-12-12"), nextDue: new Date("2026-04-19") },
    { equipmentId: eq("RF-EQ-047"), title: "Bollard Cutting Machine — Monthly PM", description: "Monthly preventive maintenance", frequency: "monthly", lastDone: new Date("2025-12-12"), nextDue: new Date("2026-05-01") },
  );

  // CST machines: Weekly/Monthly
  for (const serial of ["RF-EQ-050", "RF-EQ-051", "RF-EQ-052"]) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
      { equipmentId: eq(serial), title: `${name} — Monthly PM`, description: "Monthly preventive maintenance", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
    );
  }

  // --- JIT Forklifts: Daily operator + 180-day vendor PM ---
  for (const serial of ["RF-EQ-008", "RF-EQ-009", "RF-EQ-010", "RF-EQ-011", "RF-EQ-012"]) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — Daily operator inspection`, description: "Daily pre-shift safety and operational inspection per OSHA 1910.178", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
      { equipmentId: eq(serial), title: `${name} — JIT vendor PM (180-day)`, description: "180-day preventive maintenance by JIT Toyota-Lift", frequency: "quarterly", lastDone: new Date("2025-07-16"), nextDue: new Date("2026-01-12") },
    );
  }

  // --- Atlas Copco Compressors: Daily check + Annual vendor PM ---
  for (const serial of ["RF-EQ-013", "RF-EQ-014"]) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — Daily operator check`, description: "Daily visual/auditory check of compressor operation", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
      { equipmentId: eq(serial), title: `${name} — Atlas Copco annual vendor PM`, description: "Annual preventive maintenance by Atlas Copco Compressor Services (A/B alternating)", frequency: "annual", lastDone: new Date("2025-10-02"), nextDue: new Date("2026-10-02") },
    );
  }

  // --- EMCOR HVAC: Quarterly vendor PM (10 units) ---
  for (const serial of [
    "RF-EQ-015", "RF-EQ-016", "RF-EQ-017", "RF-EQ-018", "RF-EQ-019", "RF-EQ-020",
    "RF-EQ-021", "RF-EQ-022", "RF-EQ-023", "RF-EQ-024",
  ]) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — EMCOR quarterly vendor PM`, description: "Quarterly preventive maintenance by EMCOR Services Betlem", frequency: "quarterly", lastDone: new Date("2025-09-01"), nextDue: new Date("2025-12-01") },
    );
  }

  // --- Class C shop tools: Quarterly ---
  const classCQuarterly = [
    "RF-EQ-025", "RF-EQ-026", "RF-EQ-027", "RF-EQ-028",
    "RF-EQ-053", "RF-EQ-054", "RF-EQ-055", "RF-EQ-056", "RF-EQ-057", "RF-EQ-058",
    "RF-EQ-059", "RF-EQ-060", "RF-EQ-061", "RF-EQ-064", "RF-EQ-066", "RF-EQ-067",
  ];
  for (const serial of classCQuarterly) {
    const name = equipmentData.find((e) => e.serialNumber === serial)?.name ?? serial;
    scheduleData.push(
      { equipmentId: eq(serial), title: `${name} — Quarterly PM`, description: "Quarterly preventive maintenance and inspection", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
    );
  }

  // Pallet Jacks: Monthly
  scheduleData.push(
    { equipmentId: eq("RF-EQ-029"), title: "Pallet Jacks — Monthly inspection", description: "Monthly inspection and lubrication", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
  );

  // Kneemill: Quarterly/Semi-Annual
  scheduleData.push(
    { equipmentId: eq("RF-EQ-062"), title: "Kneemill — Quarterly PM", description: "Quarterly preventive maintenance", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
  );

  // Scissor Lift: Monthly/Quarterly (OSHA)
  scheduleData.push(
    { equipmentId: eq("RF-EQ-063"), title: "Scissor Lift — Monthly OSHA inspection", description: "Monthly safety inspection per OSHA 1910.178", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
    { equipmentId: eq("RF-EQ-063"), title: "Scissor Lift — Quarterly PM", description: "Quarterly preventive maintenance", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
  );

  // Pallet Scale: Quarterly + Annual calibration
  scheduleData.push(
    { equipmentId: eq("RF-EQ-065"), title: "Pallet Scale — Quarterly PM", description: "Quarterly preventive maintenance", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
    { equipmentId: eq("RF-EQ-065"), title: "Pallet Scale — Annual calibration", description: "Annual calibration verification — calibration log required", frequency: "annual", lastDone: null, nextDue: new Date("2027-01-01") },
  );

  // Loading Dock: Monthly
  scheduleData.push(
    { equipmentId: eq("RF-EQ-068"), title: "Loading Dock — Monthly PM", description: "Monthly dock leveler inspection; safety critical for load operations", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
  );

  // Ford F250: Per manufacturer schedule (quarterly proxy)
  scheduleData.push(
    { equipmentId: eq("RF-EQ-069"), title: "Ford F250 — OEM PM schedule", description: "Per manufacturer recommended service schedule", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
  );

  const createdSchedules = await prisma.maintenanceSchedule.createMany({
    data: scheduleData,
  });
  console.log(`Created ${createdSchedules.count} maintenance schedules`);

  // ==========================================================================
  // NCRs — 29 records from RF-OMS-2.0 Access DB
  // ==========================================================================

  await prisma.nonConformance.deleteMany();

  const ncrTypeMap: Record<string, string> = {
    Dimensional: "dimensional", Quality: "quality", Function: "function",
    Aesthetic: "aesthetic", Asthetic: "aesthetic", Safety: "safety", Compliance: "compliance",
  };
  const dispositionMap: Record<string, string> = {
    "Use as is": "use_as_is", "In-House Rework": "rework",
    Scrap: "scrap", "Return to Vendor": "return_to_vendor",
  };

  let ncrCount = 0;
  for (const ncr of accessNCRs) {
    await prisma.nonConformance.create({
      data: {
        ncrNumber: ncr.ncrNumber,
        submittedById: admin.id,
        date: ncr.initiatedDate ? new Date(ncr.initiatedDate) : new Date(),
        partNumber: ncr.partNumber || null,
        drawingNumber: ncr.drawingNumber || null,
        drawingRevision: ncr.drawingRevision || null,
        quantityAffected: ncr.quantityAffected || null,
        vendor: ncr.vendor || null,
        otherInfo: ncr.description || null,
        ncrType: ncrTypeMap[ncr.ncrType] || "quality",
        requirementDescription: ncr.requirements || "(imported — no description)",
        nonConformanceDescription: ncr.actual || ncr.description || "(imported)",
        disposition: dispositionMap[ncr.disposition] || null,
        immediateAction: ncr.immediateAction || null,
        ncrTagNumber: ncr.ncrTagNumber || null,
        plantLocation: ncr.department || null,
        status: ncr.status === "Open" ? "open" : "closed",
      },
    });
    ncrCount++;
  }
  console.log(`Created ${ncrCount} NCR records`);

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

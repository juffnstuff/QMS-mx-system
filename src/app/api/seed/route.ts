import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("key");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const full = req.nextUrl.searchParams.get("full") === "true";

  try {
    const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "changeme", 12);
    const operatorPassword = await bcrypt.hash(process.env.SEED_OPERATOR_PASSWORD || "changeme", 12);

    await prisma.user.upsert({
      where: { email: "admin@rubberform.com" },
      update: { passwordHash: adminPassword, role: "admin" },
      create: { email: "admin@rubberform.com", name: "Plant Manager", passwordHash: adminPassword, role: "admin" },
    });

    await prisma.user.upsert({
      where: { email: "anthony@rubberform.com" },
      update: { passwordHash: operatorPassword },
      create: { email: "anthony@rubberform.com", name: "Anthony", passwordHash: operatorPassword, role: "operator" },
    });

    if (!full) {
      return NextResponse.json({ success: true, message: "Passwords reset." });
    }

    // Full seed: clear existing data
    await prisma.maintenanceSchedule.deleteMany();
    await prisma.maintenanceLog.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.equipment.deleteMany();

    const equipmentData = [
      { serialNumber: "RF-EQ-001", name: "Dake 300T Single-Ram Press", type: "Press", location: "Bay 1", status: "operational", notes: "OMS-1 | Stand-alone hydraulic; single ram | ~1965 Dake 300T" },
      { serialNumber: "RF-EQ-002", name: "Large Press #1 – 9-Ram", type: "Press", location: "Bay 2", status: "operational", notes: "OMS-45 (Press 1) | Shared plenum & motor w/ Press #2 | Custom 9-Ram" },
      { serialNumber: "RF-EQ-003", name: "Large Press #2 – 9-Ram", type: "Press", location: "Bay 2", status: "operational", notes: "OMS-44 (Press 2) | Shared plenum & motor w/ Press #1 | Custom 9-Ram" },
      { serialNumber: "RF-EQ-004", name: "Small Press #1 – 5-Ram", type: "Press", location: "Bay 3", status: "operational", notes: "OMS-4 (Press 3) | Independent plenum | Custom 5-Ram" },
      { serialNumber: "RF-EQ-005", name: "Small Press #2 – 5-Ram", type: "Press", location: "Bay 3", status: "operational", notes: "OMS-2 (Press 4) | Independent plenum | Custom 5-Ram" },
      { serialNumber: "RF-EQ-046", name: "Die Cutting Press", type: "Press", location: "Production Floor", status: "operational", notes: "OMS-23 | Electric / Hydraulic | Criticality A" },
      { serialNumber: "RF-EQ-006", name: "Hot Oil Boiler (Process)", type: "Boiler", location: "Utility Room", status: "operational", notes: "Feeds compression mold heat | Gas / Electric | Criticality A" },
      { serialNumber: "RF-EQ-021", name: "Gas Fired Boiler – Heatec HCS-250/H06-141", type: "Boiler", location: "Utility / Mechanical Room", status: "operational", notes: "EMCOR agreement 7/10 | Class A — building heat loss if down | Natural Gas | Heatec HCS-250/H06-141" },
      { serialNumber: "RF-EQ-007", name: "Furnace / Oven #1", type: "Furnace", location: "Bay 1", status: "operational", notes: "Electric | Criticality A" },
      { serialNumber: "RF-EQ-008", name: "Forklift – Toyota 8FGCU25 #1", type: "Forklift", location: "Warehouse", status: "operational", notes: "OMS-14 | Toyota 8FGCU25COMP S/N 73974 | Battery | JIT $125/PM 180-day" },
      { serialNumber: "RF-EQ-009", name: "Forklift – Toyota 8FGCU25 #2", type: "Forklift", location: "Warehouse", status: "operational", notes: "OMS-15 | Toyota 8FGCU25COMP S/N 85624 | Battery | JIT $125/PM 180-day" },
      { serialNumber: "RF-EQ-010", name: "Forklift – Hyster H150F", type: "Forklift", location: "Warehouse", status: "operational", notes: "OMS-16 | Hyster H150F S/N D006T015 | Propane | JIT $160/PM 180-day" },
      { serialNumber: "RF-EQ-011", name: "Forklift – Hyundai 25L-7A", type: "Forklift", location: "Warehouse", status: "operational", notes: "OMS-17 | Hyundai 25L-7A S/N HHKHHF08CF0005999 | Propane | JIT $135/PM 180-day" },
      { serialNumber: "RF-EQ-012", name: "Forklift – Hyster N35ZRS3 (Reach Truck)", type: "Forklift", location: "Warehouse", status: "operational", notes: "Narrow-aisle reach truck | Hyster N35ZRS3-14.25 S/N C265N02077X | Battery | JIT $150/PM 180-day" },
      { serialNumber: "RF-EQ-013", name: "Air Compressor – Atlas Copco GA11VSD+FF", type: "Compressor", location: "Utility Room", status: "operational", notes: "Atlas Copco GA11VSD+FF S/N API268155 | PM $2,573.29/yr | RotoXtend oil | SMARTLINK Uptime" },
      { serialNumber: "RF-EQ-014", name: "Air Compressor – Atlas Copco GA15VSDs 10bar FF", type: "Compressor", location: "Utility Room", status: "operational", notes: "Atlas Copco GA15VSDs 10bar FF S/N ITJ802935 | PM $2,693.10/yr | RotoXtend oil | SMARTLINK Uptime" },
      { serialNumber: "RF-EQ-015", name: "Make Up Air Unit – Cambridge Warehouse Heat", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 1/10 | Cambridge MUA | Natural Gas" },
      { serialNumber: "RF-EQ-016", name: "Infrared Tube Heater #1", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 2/10 | Natural Gas" },
      { serialNumber: "RF-EQ-017", name: "Infrared Tube Heater #2", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 3/10 | Natural Gas" },
      { serialNumber: "RF-EQ-018", name: "Infrared Tube Heater #3", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 4/10 | Natural Gas" },
      { serialNumber: "RF-EQ-019", name: "Infrared Tube Heater #4", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 5/10 | Natural Gas" },
      { serialNumber: "RF-EQ-020", name: "Infrared Tube Heater #5", type: "HVAC / Heating", location: "Warehouse", status: "operational", notes: "EMCOR agreement 6/10 | Natural Gas" },
      { serialNumber: "RF-EQ-022", name: "Split System DX #1 – Office Heat/Cool", type: "HVAC", location: "Office Area", status: "operational", notes: "EMCOR agreement 8/10 | Electric / Refrigerant" },
      { serialNumber: "RF-EQ-023", name: "Split System DX #2 – Office Heat/Cool", type: "HVAC", location: "Office Area", status: "operational", notes: "EMCOR agreement 9/10 | Electric / Refrigerant" },
      { serialNumber: "RF-EQ-024", name: "Split System DX #3 – Office Heat/Cool", type: "HVAC", location: "Office Area", status: "operational", notes: "EMCOR agreement 10/10 | Electric / Refrigerant" },
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
      { serialNumber: "RF-EQ-028", name: "Welders (group)", type: "Welder", location: "Fab Area", status: "operational", notes: "Group entry — see RF-EQ-061 for specific MIG | Electric | Criticality C" },
      { serialNumber: "RF-EQ-061", name: "MIG Welder", type: "Welder", location: "Fab Area (Bay 2)", status: "operational", notes: "OMS-21 | Specific unit | Electric | Criticality C" },
      { serialNumber: "RF-EQ-029", name: "Pallet Jacks (group)", type: "Material Handling", location: "Warehouse", status: "operational", notes: "Group entry | Various | Manual | Criticality C" },
      { serialNumber: "RF-EQ-063", name: "Scissor Lift", type: "Material Handling", location: "Warehouse (Bay 2)", status: "operational", notes: "OMS-13 | Inspection per OSHA 1910.178 | Electric | Criticality B" },
      { serialNumber: "RF-EQ-030", name: "TBD – Reserved", type: "Reserved", location: "TBD", status: "needs_service", notes: "Reserved slot" },
      { serialNumber: "RF-EQ-031", name: "4in Barrel Extruder", type: "Extruder", location: "Extrusion Bay", status: "operational", notes: "OMS-5 | 4in extrusion line | Electric / Hydraulic | Criticality A" },
      { serialNumber: "RF-EQ-035", name: "6in Extruder", type: "Extruder", location: "Extrusion Bay", status: "operational", notes: "OMS-40 | 6in extrusion line | Electric / Hydraulic | Criticality A" },
      { serialNumber: "RF-EQ-032", name: "4in Extrusion Puller", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-39 | 4in line | Electric | Criticality A" },
      { serialNumber: "RF-EQ-033", name: "4in Cooling Table", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-6 | 4in line | Electric / Water | Criticality B" },
      { serialNumber: "RF-EQ-034", name: "4in Extrusion Cross Saw", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-7 | 4in line | Electric | Criticality B" },
      { serialNumber: "RF-EQ-036", name: "6in Extrusion Puller", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-42 | 6in line | Electric | Criticality A" },
      { serialNumber: "RF-EQ-037", name: "6in Extrusion Cooling Table", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-41 | 6in line | Electric / Water | Criticality B" },
      { serialNumber: "RF-EQ-038", name: "6in Extrusion Cross Saw", type: "Extrusion Aux", location: "Extrusion Bay", status: "operational", notes: "OMS-43 | 6in line | Electric | Criticality B" },
      { serialNumber: "RF-EQ-048", name: "4in Bollard Cooling Rack", type: "Extrusion Aux", location: "Bay 19", status: "operational", notes: "OMS-49 | Label: BCR-4in | IQS 4inBCR-000 S/N 1" },
      { serialNumber: "RF-EQ-049", name: "7in Bollard Cooling Rack", type: "Extrusion Aux", location: "Bay 19", status: "operational", notes: "OMS-50 | Label: BCR-7in | IQS 7inBCR-000 S/N 1" },
      { serialNumber: "RF-EQ-039", name: "Mixer #1 – Dake Area", type: "Mixer", location: "Bay 1 (Dake Area)", status: "operational", notes: "OMS-18 | Electric | Criticality A" },
      { serialNumber: "RF-EQ-040", name: "Mixer #2 – Isle", type: "Mixer", location: "Bay 2 (Isle)", status: "operational", notes: "OMS-19 | Electric | Criticality A" },
      { serialNumber: "RF-EQ-041", name: "Mixer #3 – ERC", type: "Mixer", location: "Bay 3 (ERC)", status: "operational", notes: "OMS-20 | Electric | Criticality A" },
      { serialNumber: "RF-EQ-042", name: "Bulk Bag Hopper #1", type: "Feed System", location: "Production Floor", status: "operational", notes: "OMS-28 | Electric / Pneumatic | Criticality A" },
      { serialNumber: "RF-EQ-043", name: "Bulk Bag Hopper #2", type: "Feed System", location: "Production Floor", status: "operational", notes: "OMS-29 | Electric / Pneumatic | Criticality A" },
      { serialNumber: "RF-EQ-044", name: "M1 Screw Feeder", type: "Feed System", location: "Bay 1", status: "operational", notes: "OMS-30 | Feeds press(es) | Electric | Criticality A" },
      { serialNumber: "RF-EQ-045", name: "M2 Screw Feeder", type: "Feed System", location: "Bay 2", status: "operational", notes: "OMS-31 | Feeds press(es) | Electric | Criticality A" },
      { serialNumber: "RF-EQ-047", name: "Bollard Cutting Machine", type: "Specialty Machine", location: "Bay 19", status: "operational", notes: "OMS-48 | Label: BCM-1 | IQS BCM-000 S/N 1 | Criticality A" },
      { serialNumber: "RF-EQ-050", name: "CST Inner Pole Drilling Machine", type: "Specialty Machine", location: "Machine Shop (Bay 7)", status: "operational", notes: "OMS-51 | Label: CSTDM-1 | Criticality B" },
      { serialNumber: "RF-EQ-051", name: "CST Collar Drilling Machine", type: "Specialty Machine", location: "Machine Shop (Bay 7)", status: "operational", notes: "OMS-52 | Label: CSTDM-2 | Criticality B" },
      { serialNumber: "RF-EQ-052", name: "CST Rivet Drilling Machine", type: "Specialty Machine", location: "Machine Shop (Bay 7)", status: "operational", notes: "OMS-53 | Label: CSTDM-3 | Criticality B" },
      { serialNumber: "RF-EQ-062", name: "Kneemill", type: "Machine Tool", location: "Fab Area (Bay 2)", status: "operational", notes: "OMS-38 | Electric | Criticality C" },
      { serialNumber: "RF-EQ-064", name: "Shrinkwrap Machine", type: "Packaging", location: "Shipping (Bay 1)", status: "operational", notes: "OMS-12 | Electric | Criticality C" },
      { serialNumber: "RF-EQ-066", name: "Auto Tape Dispenser", type: "Packaging", location: "Shipping (Bay 1)", status: "operational", notes: "OMS-25 | Electric | Criticality C" },
      { serialNumber: "RF-EQ-065", name: "Pallet Scale", type: "Measurement", location: "Shipping (Bay 1)", status: "operational", notes: "OMS-24 | Calibration log required | Electric | Criticality C" },
      { serialNumber: "RF-EQ-067", name: "Thermal Printer", type: "Peripheral", location: "Machine Shop (Bay 7)", status: "operational", notes: "OMS-33 | Electric | Criticality C" },
      { serialNumber: "RF-EQ-068", name: "Loading Dock", type: "Facility", location: "Shipping (Bay 1)", status: "operational", notes: "OMS-26 | Dock leveler; safety critical | Electric / Hydraulic | Criticality B" },
      { serialNumber: "RF-EQ-069", name: "Ford F250", type: "Vehicle", location: "Parking / Field", status: "operational", notes: "OMS-27 | Company vehicle; standard OEM PM schedule | Gas | Criticality B" },
    ];

    const created = await prisma.equipment.createMany({ data: equipmentData });

    // Build equipment lookup map
    const allEquipment = await prisma.equipment.findMany();
    const eqMap = new Map(allEquipment.map((e) => [e.serialNumber, e.id]));
    const eq = (s: string) => eqMap.get(s)!;
    const findName = (s: string) => equipmentData.find((e) => e.serialNumber === s)?.name ?? s;

    // Build schedule data
    type Sched = { equipmentId: string; title: string; description: string; frequency: string; lastDone: Date | null; nextDue: Date };
    const schedules: Sched[] = [];

    // Class A Daily/Weekly/Monthly
    for (const s of ["RF-EQ-001","RF-EQ-002","RF-EQ-003","RF-EQ-004","RF-EQ-005","RF-EQ-006","RF-EQ-031","RF-EQ-035","RF-EQ-046"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — Daily inspection`, description: "Daily visual and operational check per PM checklist", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
        { equipmentId: eq(s), title: `${n} — Weekly PM`, description: "Weekly preventive maintenance per PM checklist", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
        { equipmentId: eq(s), title: `${n} — Monthly PM`, description: "Monthly preventive maintenance per PM checklist", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
      );
    }
    // Furnace
    schedules.push(
      { equipmentId: eq("RF-EQ-007"), title: "Furnace / Oven #1 — Daily inspection", description: "Daily operational check", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
      { equipmentId: eq("RF-EQ-007"), title: "Furnace / Oven #1 — Weekly PM", description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
    );
    // Mixers
    for (const s of ["RF-EQ-039","RF-EQ-040","RF-EQ-041"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — Daily inspection`, description: "Daily operational check", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
        { equipmentId: eq(s), title: `${n} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
      );
    }
    // Feed systems
    for (const s of ["RF-EQ-042","RF-EQ-043","RF-EQ-044","RF-EQ-045"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — Daily inspection`, description: "Daily operational check", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
        { equipmentId: eq(s), title: `${n} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
      );
    }
    // Extrusion Aux Pullers
    for (const s of ["RF-EQ-032","RF-EQ-036"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
        { equipmentId: eq(s), title: `${n} — Monthly PM`, description: "Monthly preventive maintenance", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
      );
    }
    // Extrusion Aux Cooling/Saws/Racks
    for (const s of ["RF-EQ-033","RF-EQ-034","RF-EQ-037","RF-EQ-038","RF-EQ-048","RF-EQ-049"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
        { equipmentId: eq(s), title: `${n} — Monthly PM`, description: "Monthly preventive maintenance", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
      );
    }
    // Bollard Cutting Machine
    schedules.push(
      { equipmentId: eq("RF-EQ-047"), title: "Bollard Cutting Machine — Daily inspection", description: "Daily operational check", frequency: "daily", lastDone: new Date("2025-12-12"), nextDue: new Date("2026-04-13") },
      { equipmentId: eq("RF-EQ-047"), title: "Bollard Cutting Machine — Weekly PM", description: "Weekly preventive maintenance", frequency: "weekly", lastDone: new Date("2025-12-12"), nextDue: new Date("2026-04-19") },
      { equipmentId: eq("RF-EQ-047"), title: "Bollard Cutting Machine — Monthly PM", description: "Monthly preventive maintenance", frequency: "monthly", lastDone: new Date("2025-12-12"), nextDue: new Date("2026-05-01") },
    );
    // CST machines
    for (const s of ["RF-EQ-050","RF-EQ-051","RF-EQ-052"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — Weekly PM`, description: "Weekly preventive maintenance", frequency: "weekly", lastDone: null, nextDue: new Date("2026-04-19") },
        { equipmentId: eq(s), title: `${n} — Monthly PM`, description: "Monthly preventive maintenance", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
      );
    }
    // JIT Forklifts
    for (const s of ["RF-EQ-008","RF-EQ-009","RF-EQ-010","RF-EQ-011","RF-EQ-012"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — Daily operator inspection`, description: "Daily pre-shift safety inspection per OSHA 1910.178", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
        { equipmentId: eq(s), title: `${n} — JIT vendor PM (180-day)`, description: "180-day PM by JIT Toyota-Lift", frequency: "quarterly", lastDone: new Date("2025-07-16"), nextDue: new Date("2026-01-12") },
      );
    }
    // Atlas Copco Compressors
    for (const s of ["RF-EQ-013","RF-EQ-014"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — Daily operator check`, description: "Daily visual/auditory check of compressor operation", frequency: "daily", lastDone: null, nextDue: new Date("2026-04-13") },
        { equipmentId: eq(s), title: `${n} — Atlas Copco annual vendor PM`, description: "Annual PM by Atlas Copco Compressor Services", frequency: "annual", lastDone: new Date("2025-10-02"), nextDue: new Date("2026-10-02") },
      );
    }
    // EMCOR HVAC quarterly
    for (const s of ["RF-EQ-015","RF-EQ-016","RF-EQ-017","RF-EQ-018","RF-EQ-019","RF-EQ-020","RF-EQ-021","RF-EQ-022","RF-EQ-023","RF-EQ-024"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — EMCOR quarterly vendor PM`, description: "Quarterly PM by EMCOR Services Betlem", frequency: "quarterly", lastDone: new Date("2025-09-01"), nextDue: new Date("2025-12-01") },
      );
    }
    // Class C quarterly
    for (const s of ["RF-EQ-025","RF-EQ-026","RF-EQ-027","RF-EQ-028","RF-EQ-053","RF-EQ-054","RF-EQ-055","RF-EQ-056","RF-EQ-057","RF-EQ-058","RF-EQ-059","RF-EQ-060","RF-EQ-061","RF-EQ-064","RF-EQ-066","RF-EQ-067"]) {
      const n = findName(s);
      schedules.push(
        { equipmentId: eq(s), title: `${n} — Quarterly PM`, description: "Quarterly preventive maintenance and inspection", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
      );
    }
    // Individual items
    schedules.push(
      { equipmentId: eq("RF-EQ-029"), title: "Pallet Jacks — Monthly inspection", description: "Monthly inspection and lubrication", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
      { equipmentId: eq("RF-EQ-062"), title: "Kneemill — Quarterly PM", description: "Quarterly preventive maintenance", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
      { equipmentId: eq("RF-EQ-063"), title: "Scissor Lift — Monthly OSHA inspection", description: "Monthly safety inspection per OSHA 1910.178", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
      { equipmentId: eq("RF-EQ-063"), title: "Scissor Lift — Quarterly PM", description: "Quarterly preventive maintenance", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
      { equipmentId: eq("RF-EQ-065"), title: "Pallet Scale — Quarterly PM", description: "Quarterly preventive maintenance", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
      { equipmentId: eq("RF-EQ-065"), title: "Pallet Scale — Annual calibration", description: "Annual calibration verification — calibration log required", frequency: "annual", lastDone: null, nextDue: new Date("2027-01-01") },
      { equipmentId: eq("RF-EQ-068"), title: "Loading Dock — Monthly PM", description: "Monthly dock leveler inspection; safety critical", frequency: "monthly", lastDone: null, nextDue: new Date("2026-05-01") },
      { equipmentId: eq("RF-EQ-069"), title: "Ford F250 — OEM PM schedule", description: "Per manufacturer recommended service schedule", frequency: "quarterly", lastDone: null, nextDue: new Date("2026-07-01") },
    );

    const createdSchedules = await prisma.maintenanceSchedule.createMany({ data: schedules });

    return NextResponse.json({
      success: true,
      equipment: created.count,
      schedules: createdSchedules.count,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Seed failed", details: String(error) }, { status: 500 });
  }
}

// Equipment data from RF-OMS-2.0 Access DB — Machines table
// Only machines with enrichment data (manufacturer, model, dates) or new items

export const newEquipment = [
  {
    serialNumber: "RF-EQ-070",
    name: "Tig Welder",
    type: "Welder",
    location: "Fab Area (Bay 2)",
    status: "operational" as const,
    notes: "OMS-54 | Everlast USA | Date purchased: 2/1/2026 | Date in service: 3/1/2026 | Vendor: Everlast USA | Electric | Criticality C",
  },
];

// Enrichment updates for existing equipment — append vendor/date info to notes
export const equipmentEnrichments = [
  {
    serialNumber: "RF-EQ-047",
    appendNotes: " | Date in service: 1/6/2026",
  },
  {
    serialNumber: "RF-EQ-048",
    appendNotes: " | Date in service: 2/6/2026",
  },
  {
    serialNumber: "RF-EQ-049",
    appendNotes: " | Date in service: 2/6/2026",
  },
  {
    serialNumber: "RF-EQ-050",
    appendNotes: " | Date in service: 11/3/2025",
  },
  {
    serialNumber: "RF-EQ-051",
    appendNotes: " | Date in service: 11/3/2025",
  },
  {
    serialNumber: "RF-EQ-052",
    appendNotes: " | Date in service: 11/3/2025",
  },
];

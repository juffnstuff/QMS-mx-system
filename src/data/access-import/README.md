# Access Database Import — Implementation Spec

## Status
- [x] NCR data file (`ncrs.ts`) — 29 records, field-mapped and ready
- [x] Equipment data file (`equipment.ts`) — Tig Welder + 6 enrichments ready
- [ ] Tasks data file (`tasks.ts`) — needs to be written
- [ ] Projects data file (`projects.ts`) — needs to be written
- [ ] Import route handler (`src/app/api/seed/import-access/route.ts`) — needs to be written
- [ ] Set criticality/groupName on existing 69 equipment records in production
- [ ] Admin user assignment UI for work orders/maintenance

## Source
`RF-OMS-2.0 2-20-26.accdb` in the repo root. Use `mdb-export` to dump tables as CSV.

## Architecture
- Data files live in `src/data/access-import/` as TypeScript constants
- Import endpoint at `src/app/api/seed/import-access/route.ts`
- Same auth pattern as disabled seed endpoint: `?key=CRON_SECRET`
- Must be idempotent (safe to run multiple times)
- mdbtools cannot run in Docker/production — data must be embedded in code

## Raw Data Already Exported
The NCR and equipment data were already exported and transformed into `ncrs.ts` and `equipment.ts`. The raw CSV exports for Projects, Tasks, Employees, Departments, and Where tables were captured in the conversation but need to be transformed into TypeScript constants.

## Employee ID → Name Lookup
```
1=Bill, 2=Jeff, 3=Jake, 4=John C, 5=.., 6=Brian, 7=Anthony, 8=Joe,
9=John PMG, 10=Mike, 11=Murph, 12=Arron, 13=Scott, 14=Jesse, 15=Tommy,
16=John M, 17=A J, 18=?, 19=Eng., 20=Pro., 21=Fab., 22=Extru.,
23=Comp., 24=Admin, 25=QC, 26=Ship., 27=Vendor, 28=Main., 29=Sales
```
IDs 18-29 are department placeholders, not real people.

## Department ID → Name Lookup
```
1=Admin, 2=Management, 3=Maintenance, 4=Engineering, 5=Office,
6=Production, 7=Accounting, 8=Shipping/Receiving, 9=Compression Molding,
10=Fabrication, 11=Sales, 13=TracOut Mats, 14=Vendor, 15=Extrusion,
16=Assembly, 17=Quality
```

## Where ID → Location Lookup
```
1=Shipping and Handling Area, 2=Maintenance Area, 3=Warehouse,
4=Extrusion Line, 5=Office 2, 6=Office 1, 7=Fab Area, 8=Dock 2,
9=Dock 2 2nd floor, 10=Sign Base Work Area, 11=Paver Work Area,
12=Loading Dock, 13=Spill Berm Work Area, 14=Paint/Reflection Work Area,
15=Lkpt Bldg, 16=Offsite, 17=Press Area, 18=Outside, 19=At Vendor
```

---

## File 1: `tasks.ts`

Export the Tasks table: `mdb-export "RF-OMS-2.0 2-20-26.accdb" "Tasks"`

Group tasks by their `Project` column (which is the Access Project ID). Each task has:
- `Title`, `Priority`, `Status`, `Cost`, `Cost In Hours`, `% Complete`, `Assigned To` (Employee FK), `Description`, `Start Date`, `Due Date`

Structure as a Map: `Record<number, AccessTask[]>` where the key is the Access Project ID.

```typescript
export interface AccessTask {
  title: string;
  priority: string; // "1 High", "2 Medium", "3 Low", "3 R&D"
  status: string;   // "Not Started", "In Progress", "Completed"
  hours: number;
  percentComplete: number;
  assignedTo: string; // resolved employee name
}

export const accessTasksByProject: Record<number, AccessTask[]> = {
  4: [
    { title: "Concept production flow", priority: "2 Medium", status: "Completed", hours: 1, percentComplete: 0, assignedTo: "Extru." },
    // ...
  ],
  // ...
};
```

---

## File 2: `projects.ts`

Export the Projects table: `mdb-export "RF-OMS-2.0 2-20-26.accdb" "Projects"`

### Filtering
Only import projects with valid `Category` values: `"Current"`, `"Future"`, `"Worth Noting"`, `"X Closed X"`. This gives ~80 clean projects out of 356 rows.

### Field Mapping (Access → Prisma Project)
| Access Field | Prisma Field | Transformation |
|---|---|---|
| `Project Name` | `title` | Direct copy |
| `Category` + `Old Notes` + `New Notes` | `description` | Combine. Strip HTML from Old Notes: `str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()`. Append tasks as bullet list. |
| `Priority` | `priority` | `"1 Now"` or `"1.x"` → `"critical"`, `"2 Next"` → `"high"`, `"3 R&D"` or `"4 Planning"` → `"medium"`, `"5 Discovery"` or `"7 Idea"` → `"low"` |
| `Status` + `Category` | `status` | `"X Closed X"` category → `"completed"`, `"Not Started"` → `"planning"`, `"In Progress"` → `"in_progress"` |
| `Start Date` | `createdAt` | Parse `"MM/DD/YY HH:MM:SS"` format |
| `End Date` | `dueDate` | Parse if present |
| `Budget` | `budget` | Convert number to string |
| `Budget in Hrs` | `designRequirements` | Store as `"Budget Hours: {n}"` |
| `Owner` | description | Resolve Employee FK → name, include in description |
| `Department` | description | Resolve Department FK → name, include in description |
| `Category` | `phase` | `"X Closed X"` → `"complete"`, `"Current"` → `"production_release"`, `"Future"` or `"Worth Noting"` → `"concept"` |
| N/A | `createdById` | Admin user ID (look up `admin@rubberform.com`) |

### Task Embedding
For each project, look up tasks from `accessTasksByProject[projectAccessId]` and append to description:
```
--- Historical Tasks ---
- [Completed] Concept production flow (1 hr, Extru.)
- [Not Started] Build Phase 1 of line (10 hrs, Extru.)
```

### Structure
```typescript
export interface AccessProject {
  accessId: number; // Original Access DB ID for task lookup
  title: string;
  description: string; // Combined: category + cleaned notes + new notes
  priority: string;    // Already mapped: "critical" | "high" | "medium" | "low"
  status: string;      // Already mapped: "planning" | "in_progress" | "completed"
  phase: string;       // Already mapped: "concept" | "production_release" | "complete"
  budget: string | null;
  budgetHours: number;
  dueDate: string | null; // ISO date string
  createdAt: string | null; // ISO date string
  owner: string;       // Resolved employee name
  department: string;  // Resolved department name
}

export const accessProjects: AccessProject[] = [ ... ];
```

---

## File 3: `src/app/api/seed/import-access/route.ts`

### Auth
Same pattern: `?key=CRON_SECRET` query param.

### Execution Order
1. Look up admin user (`admin@rubberform.com`) and anthony user (`anthony@rubberform.com`)
2. Fail if admin user not found (seed must have run first)
3. **Equipment**: upsert Tig Welder (RF-EQ-070), update notes on RF-EQ-047 through RF-EQ-052
4. **Equipment criticality/groups**: update all 70 equipment records with correct criticality and groupName values using `prisma.equipment.update()` keyed by serialNumber
5. **NCRs**: upsert 29 records keyed on `ncrNumber`. Map `identifiedByIsAnthony` → anthony user, else admin user for `submittedById`
6. **Projects**: create ~80 records. Check title existence first to skip duplicates. Embed task summaries from `accessTasksByProject` into description.
7. Return JSON summary: `{ success: true, equipment: N, ncrs: N, projects: N }`

### NCR Field Mapping (at import time)
```typescript
ncrType mapping: "Dimensional" → "dimensional", "Asthetic"/"Aesthetic" → "aesthetic",
                 "Function" → "function", "Quality" → "quality"
disposition mapping: "In-House Rework" → "rework", "Use as is" → "use_as_is",
                     "Scrap" → "scrap", "Return to Vendor" → "return_to_vendor"
status mapping: "Open" → "open", "Closed" → "closed"
```

### Equipment Criticality Values (to set via import)
These are the correct criticality and groupName values for all 70 equipment items. The seed data in the disabled `route.ts` had these embedded — the import endpoint needs to set them on the live database.

```
Class A: RF-EQ-001 (Dake, group: "Dake Press System"), RF-EQ-002 (group: "Large Press System"),
  RF-EQ-003 (group: "Large Press System"), RF-EQ-004, RF-EQ-005, RF-EQ-046, RF-EQ-006, RF-EQ-021,
  RF-EQ-007, RF-EQ-013, RF-EQ-014, RF-EQ-031 (group: "4in Extrusion Line"),
  RF-EQ-035 (group: "6in Extrusion Line"), RF-EQ-032 (group: "4in Extrusion Line"),
  RF-EQ-036 (group: "6in Extrusion Line"), RF-EQ-039 (group: "Dake Press System"),
  RF-EQ-040, RF-EQ-041, RF-EQ-042 (group: "Dake Press System"), RF-EQ-043,
  RF-EQ-044, RF-EQ-045, RF-EQ-047 (group: "Bollard Production System")

Class B: RF-EQ-008, RF-EQ-009, RF-EQ-010, RF-EQ-011, RF-EQ-012, RF-EQ-015,
  RF-EQ-016, RF-EQ-017, RF-EQ-018, RF-EQ-019, RF-EQ-020, RF-EQ-063, RF-EQ-068,
  RF-EQ-069, RF-EQ-033 (group: "4in Extrusion Line"), RF-EQ-034 (group: "4in Extrusion Line"),
  RF-EQ-037 (group: "6in Extrusion Line"), RF-EQ-038 (group: "6in Extrusion Line"),
  RF-EQ-048 (group: "Bollard Production System"), RF-EQ-049 (group: "Bollard Production System"),
  RF-EQ-050 (group: "CST Drilling System"), RF-EQ-051 (group: "CST Drilling System"),
  RF-EQ-052 (group: "CST Drilling System")

Class C: Everything else (RF-EQ-022 through RF-EQ-030, RF-EQ-053 through RF-EQ-062,
  RF-EQ-064 through RF-EQ-067, RF-EQ-070)
```

---

## Remaining Feature: Admin User Assignment

The user wants admins to be able to assign any user to maintenance tasks, work orders, etc. Currently `assignedToId` exists on WorkOrder but the UI may not have a user picker. Need to:
1. Check work order form for user assignment dropdown
2. Add user picker if missing (fetch all users, show in select)
3. Same for maintenance schedule assignment if applicable

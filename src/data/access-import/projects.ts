/**
 * Project data exported from RF-OMS-2.0 2-20-26.accdb via mdb-export.
 * Split by Access category. "X Closed X" projects excluded.
 */

export interface AccessProject {
  accessId: number;
  title: string;
  category: "Current" | "Future" | "Worth Noting";
  priority: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budgetHrs: number;
  budget: number;
  notes: string | null;
  department: string | null;
}

export { currentProjects } from "./projects-current";
export { futureProjects } from "./projects-future";
export { worthNotingProjects } from "./projects-other";

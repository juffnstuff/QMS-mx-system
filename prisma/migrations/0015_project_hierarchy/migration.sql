-- Project parent/child hierarchy: sub-projects/tasks roll up to a main project

ALTER TABLE "Project" ADD COLUMN "parentProjectId" TEXT;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_parentProjectId_fkey"
  FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Project_parentProjectId_idx" ON "Project"("parentProjectId");

-- Super admin flag: super admins are implicitly admins and can delete users.

ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Promote jeff@rubberform.com on deploy (no-op if user not present yet).
UPDATE "User"
  SET "isSuperAdmin" = true, "role" = 'admin'
  WHERE "email" = 'jeff@rubberform.com';

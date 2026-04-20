-- Split User.name into firstName + lastName while keeping name for display.

ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Backfill: first token of name -> firstName, everything after -> lastName.
UPDATE "User"
SET
  "firstName" = CASE
    WHEN TRIM(COALESCE("name", '')) = '' THEN NULL
    ELSE SPLIT_PART(TRIM("name"), ' ', 1)
  END,
  "lastName" = CASE
    WHEN TRIM(COALESCE("name", '')) = '' THEN NULL
    WHEN POSITION(' ' IN TRIM("name")) = 0 THEN NULL
    ELSE TRIM(SUBSTRING(TRIM("name") FROM POSITION(' ' IN TRIM("name")) + 1))
  END;

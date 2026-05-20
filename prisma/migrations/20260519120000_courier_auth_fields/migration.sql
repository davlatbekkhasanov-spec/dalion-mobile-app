-- Courier self-registration: vehicle plate + password login
ALTER TABLE "courier_applications" ADD COLUMN IF NOT EXISTS "vehiclePlate" TEXT NOT NULL DEFAULT '';
ALTER TABLE "courier_applications" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "courier_applications" ADD COLUMN IF NOT EXISTS "passwordSetAt" TIMESTAMP(3);

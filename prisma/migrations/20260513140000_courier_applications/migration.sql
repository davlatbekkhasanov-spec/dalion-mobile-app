-- Courier partner applications (marketplace profile → portal token)
CREATE TABLE "courier_applications" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'approved',
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "courier_applications_accessToken_key" ON "courier_applications"("accessToken");

CREATE INDEX "courier_applications_phone_idx" ON "courier_applications"("phone");

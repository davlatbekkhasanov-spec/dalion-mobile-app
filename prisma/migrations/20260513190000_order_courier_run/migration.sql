-- Batch routing: one courier may hold multiple active orders in one run (ordered stops).
ALTER TABLE "Order" ADD COLUMN "courierRunId" TEXT;
ALTER TABLE "Order" ADD COLUMN "courierStopSeq" INTEGER;

CREATE INDEX "Order_courierRunId_idx" ON "Order"("courierRunId");
CREATE INDEX "Order_courierPhone_status_idx" ON "Order"("courierPhone", "status");

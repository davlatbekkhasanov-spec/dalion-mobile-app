-- Faster paginated catalog reads for active products ordered by createdAt.
CREATE INDEX IF NOT EXISTS "Product_active_createdAt_idx" ON "Product" ("active", "createdAt");

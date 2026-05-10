CREATE TABLE IF NOT EXISTS "payme_transactions" (
    "payme_transaction_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 1,
    "reason" INTEGER,
    "create_time" BIGINT NOT NULL DEFAULT 0,
    "perform_time" BIGINT NOT NULL DEFAULT 0,
    "cancel_time" BIGINT NOT NULL DEFAULT 0,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB,

    CONSTRAINT "payme_transactions_pkey" PRIMARY KEY ("payme_transaction_id")
);

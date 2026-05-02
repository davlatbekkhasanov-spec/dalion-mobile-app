create table if not exists payme_transactions (
  payme_transaction_id text primary key,
  order_id text,
  amount numeric not null default 0,
  state integer not null default 1,
  reason integer,
  create_time bigint not null default 0,
  perform_time bigint not null default 0,
  cancel_time bigint not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  raw_data jsonb
);

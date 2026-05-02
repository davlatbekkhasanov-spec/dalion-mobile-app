create table if not exists products (
  id text primary key,
  code text unique,
  source text,
  name text not null,
  category text,
  price numeric not null default 0,
  old_price numeric,
  stock integer not null default 0,
  image_url text,
  is_active boolean default true,
  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  order_number text unique,
  customer_name text,
  customer_phone text,
  status text,
  payment_method text,
  payment_status text,
  address text,
  delivery_price numeric default 0,
  total numeric default 0,
  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists order_items (
  id text primary key,
  order_id text references orders(id) on delete cascade,
  product_id text,
  product_name text,
  qty integer,
  price numeric,
  raw_data jsonb
);

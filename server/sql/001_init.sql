create table if not exists shops (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  name text not null,
  phone text not null default '',
  role text not null check (role in ('admin', 'employee')),
  pin_hash text not null,
  pin_salt text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (shop_id, name)
);

alter table users add column if not exists pin_note text not null default '';

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id),
  shop_id uuid not null references shops(id),
  expires_at timestamptz not null
);

create table if not exists pockets (
  shop_id uuid not null references shops(id),
  id text not null,
  name_bn text not null,
  sort int not null,
  primary key (shop_id, id)
);

create table if not exists people (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  name text not null,
  phone text not null default '',
  created_at timestamptz not null,
  created_by uuid references users(id)
);

create table if not exists transactions (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  txn_type text not null,
  amount_paisa bigint not null,
  date date not null,
  status text not null check (status in ('active', 'void')),
  device_id text not null,
  created_by uuid references users(id),
  created_at timestamptz not null,
  void_reason text,
  voided_at timestamptz
);

create table if not exists txn_legs (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  txn_id uuid not null references transactions(id),
  pocket_id text not null,
  amount_paisa bigint not null
);

create table if not exists loans (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  person_id uuid not null references people(id),
  direction text not null check (direction in ('lend', 'borrow')),
  principal_paisa bigint not null,
  pocket_id text not null,
  opened_at timestamptz not null,
  due_at timestamptz,
  closed_at timestamptz,
  status text not null check (status in ('open', 'partial', 'closed')),
  created_by uuid references users(id)
);

create table if not exists loan_events (
  id uuid primary key,
  shop_id uuid not null references shops(id),
  loan_id uuid not null references loans(id),
  type text not null check (type in ('open', 'repayment')),
  amount_paisa bigint not null,
  at timestamptz not null,
  actor_id uuid references users(id),
  note text not null default ''
);

alter table users add column if not exists phone text not null default '';
create unique index if not exists users_shop_phone on users (shop_id, phone) where phone <> '';
alter table transactions add column if not exists phone text not null default '';
alter table transactions add column if not exists party text not null default '';
insert into pockets (shop_id, id, name_bn, sort)
select s.id, 'PHARMA', 'ফার্মেসি', 5 from shops s
on conflict do nothing;
create index if not exists transactions_shop_date on transactions (shop_id, date);
create index if not exists loans_shop_status on loans (shop_id, status);

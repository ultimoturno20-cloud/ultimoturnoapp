begin;
create table order_boards (
 id uuid primary key,
 business_id uuid not null references businesses(id),
 name text not null check(length(name) between 1 and 80),
 created_at timestamptz not null default now(),
 unique(id,business_id)
);
create table order_board_columns (
 id uuid primary key,
 business_id uuid not null references businesses(id),
 board_id uuid not null,
 name text not null check(length(name) between 1 and 80),
 position integer not null default 0,
 unique(id,business_id),
 foreign key(board_id,business_id) references order_boards(id,business_id) on delete cascade
);
create table order_board_cards (
 sale_id uuid primary key references sales(id) on delete cascade,
 business_id uuid not null references businesses(id),
 column_id uuid not null,
 position integer not null default 0,
 foreign key(column_id,business_id) references order_board_columns(id,business_id) on delete cascade
);
create index order_board_business on order_boards(business_id);
create index order_board_card_column on order_board_cards(column_id,position);
commit;

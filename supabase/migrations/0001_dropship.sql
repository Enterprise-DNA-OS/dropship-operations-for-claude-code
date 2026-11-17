create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function immutable_record() returns trigger language plpgsql as $$ begin raise exception 'Append-only evidence cannot be changed'; end $$;
create table workspace(id integer primary key check(id=1), name text not null, demo boolean not null default false, stock_hours integer not null default 48 check(stock_hours between 1 and 720), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table vendors(id uuid primary key default gen_random_uuid(), name text not null, owner text not null default '', evidence text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index vendor_name_unique on vendors(lower(name));
create table products(id uuid primary key default gen_random_uuid(), source_id text not null unique, vendor_id uuid not null references vendors, retailer_sku text not null, vendor_sku text not null, name text not null, currency text not null check(currency in ('NZD','AUD','USD','GBP','EUR','CAD')), cost_cents bigint not null check(cost_cents between 0 and 1000000000), price_cents bigint not null check(price_cents between 0 and 1000000000), available integer not null check(available between 0 and 1000000), active boolean not null, stock_at timestamptz not null, source text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(vendor_id,vendor_sku));
create table purchase_orders(id uuid primary key default gen_random_uuid(), source_id text not null unique, number text not null unique, customer_order text not null, vendor_id uuid not null references vendors, currency text not null check(currency in ('NZD','AUD','USD','GBP','EUR','CAD')), placed_on date not null, confirmed_at timestamptz, delivery_due date, retention_review date not null, evidence text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table items(id uuid primary key default gen_random_uuid(), source_id text not null unique, po_id uuid not null references purchase_orders, vendor_sku text not null, name text not null, quantity integer not null check(quantity between 1 and 1000000), baseline_shipped integer not null default 0 check(baseline_shipped>=0 and baseline_shipped<=quantity), unit_cost_cents bigint not null check(unit_cost_cents between 0 and 1000000000), promise_on date, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table shipments(id uuid primary key default gen_random_uuid(), item_id uuid not null references items, reference text not null, quantity integer not null check(quantity>0), carrier text not null, tracking text not null, shipped_on date not null, delivered_on date check(delivered_on>=shipped_on), evidence text not null, operator text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(item_id,reference));
create table returns(id uuid primary key default gen_random_uuid(), item_id uuid not null references items, reference text not null unique, quantity integer not null check(quantity>0), reason text not null, review_due date not null, outcome text, resolved_on date, operator text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check((outcome is null)=(resolved_on is null)));
create table history(id uuid primary key default gen_random_uuid(), action text not null, operator text not null, detail jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table imports(id uuid primary key default gen_random_uuid(), kind text not null, digest text not null, rows integer not null, source text not null, operator text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
do $$ declare t text; begin
 foreach t in array array['workspace','vendors','products','purchase_orders','items','shipments','returns'] loop execute format('create trigger touch before update on %I for each row execute function touch_updated()',t);end loop;
 foreach t in array array['history','imports'] loop execute format('create trigger immutable before update or delete on %I for each row execute function immutable_record()',t);end loop;
 foreach t in array array['workspace','vendors','products','purchase_orders','items','shipments','returns','history','imports'] loop execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public',t);end loop;
end $$;
create view v_balances as
select i.id,i.source_id,i.po_id,p.number,p.customer_order,v.name vendor,p.currency,i.vendor_sku,i.name,i.quantity,i.unit_cost_cents,i.promise_on,p.delivery_due,p.confirmed_at,
(i.baseline_shipped+coalesce(s.shipped,0))::integer shipped,
(i.quantity-i.baseline_shipped-coalesce(s.shipped,0))::integer outstanding,
coalesce(s.delivered,0)::integer delivery_evidenced,
coalesce(r.returned,0)::integer returned,
(p.confirmed_at is null and p.placed_on<current_date) unconfirmed,
(i.promise_on<current_date and i.quantity>i.baseline_shipped+coalesce(s.shipped,0)) late
from items i join purchase_orders p on p.id=i.po_id join vendors v on v.id=p.vendor_id
left join(select item_id,sum(quantity) shipped,sum(case when delivered_on is not null then quantity else 0 end) delivered from shipments group by item_id)s on s.item_id=i.id
left join(select item_id,sum(quantity) returned from returns group by item_id)r on r.item_id=i.id;
create view v_stock as select p.*,v.name vendor,(p.stock_at<now()-make_interval(hours=>w.stock_hours)) stale,
(p.price_cents-p.cost_cents) unit_spread_cents from products p join vendors v on v.id=p.vendor_id cross join workspace w;
create view v_supplier_review as select v.id,v.name,v.owner,p.currency,count(b.id)::integer lines,
coalesce(sum(b.outstanding),0)::bigint units_outstanding,
count(b.id) filter(where b.late)::integer late_lines,
count(b.id) filter(where b.unconfirmed and b.outstanding>0)::integer unconfirmed_lines,
coalesce(sum(b.outstanding::bigint*b.unit_cost_cents),0)::bigint outstanding_cost_cents
from vendors v left join purchase_orders p on p.vendor_id=v.id left join v_balances b on b.po_id=p.id group by v.id,v.name,v.owner,p.currency;
create view v_attention as
select 'LATE-PROMISE' rule,number reference,vendor,source_id detail from v_balances where late
union all select 'UNCONFIRMED',number,vendor,source_id from v_balances where unconfirmed and outstanding>0
union all select 'MISSING-PROMISE',number,vendor,source_id from v_balances where promise_on is null and outstanding>0
union all select 'STALE-STOCK',retailer_sku,vendor,source_id from v_stock where stale and active
union all select 'RETURN-REVIEW',r.reference,v.name,r.reason from returns r join items i on i.id=r.item_id join purchase_orders p on p.id=i.po_id join vendors v on v.id=p.vendor_id where r.resolved_on is null and r.review_due<current_date;
revoke all on v_balances,v_stock,v_supplier_review,v_attention from public;

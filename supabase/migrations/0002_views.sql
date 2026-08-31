-- Flattened payment ledger used by the /payments page and CSV exports.
-- One row per financial event across the GENERADO -> ENVIADO -> PAGADO
-- flow, joining orders, finance_submissions and payments through the
-- shared user/store keys established in 0001_init.sql.

create or replace view v_payment_ledger as
select
  o.id as order_pk,
  o.order_id,
  o.delivery_date as event_date,
  u.id as user_id,
  u.phone as user_phone,
  u.full_name as user_name,
  s.id as store_id,
  s.name as store_name,
  z.name as zone_name,
  o.generated_amount,
  fs.amount as submitted_amount,
  fs.submitted_date,
  fs.master_pagos_approved,
  p.amount as paid_amount,
  p.paid_at,
  case
    when p.id is not null then 'PAGADO'
    when fs.id is not null and fs.master_pagos_approved then 'ENVIADO_A_FINANZAS'
    when fs.id is not null and not fs.master_pagos_approved then 'EN_PROCESO'
    when o.id is not null then 'GENERADO'
    else 'PENDIENTE'
  end as status,
  o.order_id as reference
from orders o
left join users u on u.id = o.user_id
left join stores s on s.id = o.store_id
left join zones z on z.id = o.zone_id
left join finance_submissions fs on fs.order_id = o.id
left join payments p on p.user_id = o.user_id and p.store_id = o.store_id;

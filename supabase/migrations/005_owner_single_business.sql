with ranked as (
  select id, row_number() over (partition by owner_user_id order by created_at desc, id desc) as rn
  from business_owners
)
delete from business_owners bo
using ranked r
where bo.id = r.id and r.rn > 1;

create unique index if not exists business_owners_owner_unique
on business_owners(owner_user_id);

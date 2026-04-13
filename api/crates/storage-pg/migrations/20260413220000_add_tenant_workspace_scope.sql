create table if not exists tenants (
  id uuid primary key,
  code text not null unique,
  name text not null,
  is_root boolean not null default false,
  is_hidden boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into tenants (id, code, name, is_root, is_hidden)
values (
  '00000000-0000-0000-0000-000000000001',
  'root-tenant',
  'Root Tenant',
  true,
  true
)
on conflict (code) do update
set name = excluded.name,
    is_root = excluded.is_root,
    is_hidden = excluded.is_hidden,
    updated_at = now();

alter table teams
  add column if not exists tenant_id uuid references tenants(id);

update teams
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table teams
  alter column tenant_id set not null;

with duplicated_workspaces as (
  select id,
         row_number() over (
           partition by tenant_id, lower(name)
           order by created_at asc, id asc
         ) as duplicate_rank
  from teams
)
update teams
set name = concat(teams.name, ' [workspace-', teams.id::text, ']')
from duplicated_workspaces
where teams.id = duplicated_workspaces.id
  and duplicated_workspaces.duplicate_rank > 1;

create unique index if not exists teams_tenant_name_uidx
  on teams (tenant_id, lower(name));

alter table roles
  drop constraint if exists roles_scope_kind_check;

update roles
set scope_kind = case
  when scope_kind = 'app' then 'system'
  when scope_kind = 'team' then 'workspace'
  else scope_kind
end
where scope_kind in ('app', 'team');

drop index if exists roles_app_code_uidx;
drop index if exists roles_team_code_uidx;

create unique index if not exists roles_system_code_uidx
  on roles (code)
  where scope_kind = 'system';

create unique index if not exists roles_workspace_code_uidx
  on roles (team_id, code)
  where scope_kind = 'workspace';

alter table roles
  add constraint roles_scope_kind_check check (scope_kind in ('system', 'workspace'));

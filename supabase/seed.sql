-- =============================================================================
-- Local development / test seed. NEVER run against production.
-- Creates one business ("Kape Roastery") with one user per role.
-- Passwords are intentionally simple and documented in .env.example.
-- =============================================================================

create or replace function pg_temp.seed_user(p_id uuid, p_email text, p_password text, p_full_name text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p_full_name),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
end;
$$;

select pg_temp.seed_user('11111111-1111-4111-8111-111111111111', 'owner@coffee.test', 'OwnerPass123!', 'Olivia Owner');
select pg_temp.seed_user('22222222-2222-4222-8222-222222222222', 'roaster@coffee.test', 'RoasterPass123!', 'Rafael Roaster');
select pg_temp.seed_user('33333333-3333-4333-8333-333333333333', 'inventory@coffee.test', 'InventoryPass123!', 'Ines Inventory');
select pg_temp.seed_user('44444444-4444-4444-8444-444444444444', 'sales@coffee.test', 'SalesPass123!', 'Sam Sales');
select pg_temp.seed_user('55555555-5555-4555-8555-555555555555', 'viewer@coffee.test', 'ViewerPass123!', 'Vera Viewer');
-- A second business owner, used to prove cross-business isolation in tests.
select pg_temp.seed_user('66666666-6666-4666-8666-666666666666', 'other-owner@coffee.test', 'OtherPass123!', 'Otto Other');

do $$
declare
  v_business uuid;
  v_other uuid;
begin
  v_business := public.create_business_with_owner('Kape Roastery', '11111111-1111-4111-8111-111111111111', 'kape-roastery');
  perform app.seed_example_green_coffees(v_business);

  insert into public.business_members (business_id, user_id, role) values
    (v_business, '22222222-2222-4222-8222-222222222222', 'roaster'),
    (v_business, '33333333-3333-4333-8333-333333333333', 'inventory_staff'),
    (v_business, '44444444-4444-4444-8444-444444444444', 'sales_staff'),
    (v_business, '55555555-5555-4555-8555-555555555555', 'viewer');

  v_other := public.create_business_with_owner('Other Roastery', '66666666-6666-4666-8666-666666666666', 'other-roastery');
end;
$$;

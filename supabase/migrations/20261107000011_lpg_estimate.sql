-- =============================================================================
-- LPG cost estimate for roast completion.
-- The LPG / fuel production cost is pre-filled from the roast's total duration using a fixed
-- gas profile (time-weighted average kPa of the business's standard curve) and two calibration
-- numbers kept here: LPG use at that profile (kg per hour) and the LPG price per kg.
-- Defaults: Yoshan DY-2 seller listings quote about 0.2 kg/h; Philippine retail LPG in
-- November 2026 is about PHP 127/kg (PHP 1,398 per 11 kg tank). Owners can overwrite both.
-- =============================================================================

alter table public.business_settings
  add column lpg_price_per_kg numeric(10, 2) not null default 127.00
    check (lpg_price_per_kg >= 0 and lpg_price_per_kg <= 100000),
  add column lpg_kg_per_hour numeric(7, 3) not null default 0.200
    check (lpg_kg_per_hour >= 0 and lpg_kg_per_hour <= 100),
  add column lpg_profile_avg_kpa numeric(6, 2) not null default 1.90
    check (lpg_profile_avg_kpa >= 0 and lpg_profile_avg_kpa <= 1000);

comment on column public.business_settings.lpg_price_per_kg is 'Retail LPG price per kg used for the roast fuel estimate.';
comment on column public.business_settings.lpg_kg_per_hour is 'LPG consumed per hour of roasting at the standard gas profile. 0 disables the estimate.';
comment on column public.business_settings.lpg_profile_avg_kpa is 'Time-weighted average gas pressure of the standard roast profile (informational, shown in the estimate breakdown).';

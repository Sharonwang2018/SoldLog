-- Poster-only privacy: strip leading street number from address line on generated images; city_state unchanged.
alter table public.profiles
  add column if not exists poster_address_privacy boolean not null default false;

comment on column public.profiles.poster_address_privacy is
  'When true, SoldLog posters omit a leading house number from the street line (e.g. 32 Winterwind Ct → Winterwind Ct).';

-- 0014: atomic auction-listing creation. The pairing constraint (0013)
-- demands listing + auction in ONE transaction, which two PostgREST
-- calls can never be — so creation is an RPC. Runs as the caller
-- (security invoker): the normal listing/auction RLS insert policies
-- still apply.

create or replace function public.create_auction_listing(
  p_input jsonb,
  p_starting_price numeric,
  p_reserve_price numeric,
  p_duration_hours integer
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_listing_id uuid;
  v_currency text := coalesce(nullif(p_input->>'currency', ''), 'USD');
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_duration_hours is null or p_duration_hours not in (1, 6, 24, 72, 168) then
    raise exception 'invalid auction duration';
  end if;

  insert into public.listings
    (seller_id, title, game, set_name, card_number, language, condition,
     finish, grade_company, grade_value, price, currency, quantity,
     description, sale_type)
  values
    (auth.uid(),
     p_input->>'title',
     (p_input->>'game')::public.game_type,
     coalesce(p_input->>'set_name', ''),
     coalesce(p_input->>'card_number', ''),
     coalesce(nullif(p_input->>'language', ''), 'English'),
     (p_input->>'condition')::public.condition_type,
     coalesce(nullif(p_input->>'finish', ''), 'normal')::public.finish_type,
     nullif(p_input->>'grade_company', ''),
     nullif(p_input->>'grade_value', ''),
     -- the listing price mirrors the current bid; it starts at the floor
     p_starting_price,
     v_currency,
     1,
     coalesce(p_input->>'description', ''),
     'auction')
  returning id into v_listing_id;

  insert into public.auctions
    (listing_id, seller_id, starting_price, reserve_price, currency, ends_at)
  values
    (v_listing_id, auth.uid(), p_starting_price, p_reserve_price, v_currency,
     now() + make_interval(hours => p_duration_hours));

  return v_listing_id;
end;
$$;

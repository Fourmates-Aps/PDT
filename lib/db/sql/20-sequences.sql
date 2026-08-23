-- Order numbers.
--
-- A sequence rather than count(*) + 1: two employees checking out in the same
-- second would otherwise compute the same number, and one insert would fail on
-- the unique index. nextval is atomic and never hands out the same value twice,
-- even under concurrency.
--
-- Gaps are expected (a rolled-back order consumes a number) and are fine — an
-- order number is an identifier, not a count of orders.

create sequence if not exists public.order_number_seq
  as bigint
  start with 1
  increment by 1;

grant usage, select on sequence public.order_number_seq to authenticated, service_role;

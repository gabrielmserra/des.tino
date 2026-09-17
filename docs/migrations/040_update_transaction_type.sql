-- =====================================================================
-- Corrige update_transaction: nao era possivel mudar o tipo (ex.:
-- entrada variavel -> entrada fixa) editando um lancamento -- a funcao
-- nunca recebia nem aplicava esse campo, entao a mudanca era descartada
-- silenciosamente e reabrir o lancamento mostrava o tipo antigo de
-- novo. add_transaction sempre teve p_type; update_transaction nunca
-- teve o equivalente.
--
-- p_type default null preserva o tipo atual quando nao informado
-- (compatibilidade com qualquer chamador que ainda nao manda esse
-- parametro).
--
-- Rodar no SQL Editor do Supabase (apos 001-039).
-- =====================================================================

drop function if exists update_transaction(bigint, text, numeric, text, bigint, bigint, boolean, bigint, text, date, time);

create or replace function update_transaction(
  p_id             bigint,
  p_description    text,
  p_amount         numeric,
  p_category       text,
  p_card_id        bigint default null,
  p_benefit_id     bigint default null,
  p_is_expectation boolean default false,
  p_debit_card_id  bigint default null,
  p_payment_method text default null,
  p_payment_date   date default null,
  p_payment_time   time default null,
  p_type           text default null
) returns void
language plpgsql
as $$
declare
  v_old transactions;
begin
  select * into v_old from transactions where id = p_id;
  if not found then return; end if;

  if v_old.benefit_id is not null and not coalesce(v_old.is_expectation, false) then
    update benefit_cards set balance = balance + v_old.amount where id = v_old.benefit_id;
  end if;

  update transactions set
    type           = coalesce(p_type, type),
    description    = p_description,
    amount         = p_amount,
    category       = coalesce(p_category, 'Outros'),
    card_id        = p_card_id,
    benefit_id     = p_benefit_id,
    is_expectation = coalesce(p_is_expectation, false),
    debit_card_id  = p_debit_card_id,
    payment_method = p_payment_method,
    payment_date   = p_payment_date,
    payment_time   = p_payment_time
  where id = p_id;

  if p_benefit_id is not null and not coalesce(p_is_expectation, false) then
    update benefit_cards set balance = balance - p_amount where id = p_benefit_id;
  end if;
end;
$$;

grant execute on function update_transaction(
  bigint, text, numeric, text, bigint, bigint, boolean, bigint, text, date, time, text
) to authenticated;

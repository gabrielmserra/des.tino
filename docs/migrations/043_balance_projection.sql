-- =====================================================================
-- Alerta de saldo projetado negativo: simula dia a dia, do dia de hoje
-- até o fim do mês corrente, o saldo esperado — descontando o que vence
-- em cada dia (contas fixas, parcelas de dívida, fatura de cartão em
-- aberto e parcelas futuras previstas) e somando o que se espera
-- receber (plan_income_items do plano do mês). Existe um "buraco" que
-- os widgets atuais não pegam: o mês pode fechar positivo no total, mas
-- ter um dia específico, no meio do caminho, em que várias contas vencem
-- antes da próxima entrada cair — nesse dia o saldo ficaria negativo na
-- vida real, mesmo sem aparecer em nenhum resumo mensal.
--
-- Regras de cada fonte (decisões de produto, não só técnicas):
--   - Contas fixas e fatura de cartão têm dia certo (due_day/vencimento
--     calculado) — se já venceram e continuam não pagas, contam como
--     devidas HOJE (vencido = cobrança imediata na simulação).
--   - Parcela de dívida não tem dia certo cadastrado (só due_year/
--     due_month) — por decisão do usuário, toda parcela de dívida não
--     paga do mês corrente conta como devida HOJE (mais conservador:
--     nunca deixa passar batido, mesmo que gere aviso um pouco cedo
--     demais em relação ao vencimento real).
--   - Entradas esperadas com expected_day já passado não entram de novo
--     (presume-se já refletidas no saldo real, se de fato caíram) — só
--     conta entrada a partir de hoje em diante.
--
-- Só retorna algo quando o mês selecionado é o mês corrente de verdade
-- (a simulação não faz sentido pra um mês passado ou futuro) e quando
-- acha pelo menos um dia em que o saldo projetado cruza zero — silêncio
-- total (retorna null) se não encontra nenhum problema.
--
-- Rodar no SQL Editor do Supabase (após 001-042).
-- =====================================================================

create or replace function get_balance_projection(p_month_id bigint)
returns json
language plpgsql
stable
as $$
declare
  v_year            int;
  v_month           int;
  v_today           date := current_date;
  v_day_today       int := extract(day from current_date)::int;
  v_last_day        int;
  v_balance         numeric;
  v_day             int;
  v_amount          numeric;
  v_first_day       int;
  v_first_balance   numeric;
  v_next_income_day int;
begin
  select year, month into v_year, v_month
  from months
  where id = p_month_id and user_id = auth.uid();

  if v_year is null
     or v_year  <> extract(year from v_today)::int
     or v_month <> extract(month from v_today)::int then
    return null;
  end if;

  v_last_day := extract(day from (date_trunc('month', v_today) + interval '1 month - 1 day'))::int;
  v_balance  := get_saldo_acumulado(p_month_id);

  for v_day in v_day_today..v_last_day loop
    -- Contas fixas não pagas deste mês (vencidas contam hoje).
    select coalesce(sum(fbi.amount), 0) into v_amount
    from fixed_bill_instances fbi
    join fixed_bills fb on fb.id = fbi.bill_id
    where fbi.user_id = auth.uid()
      and fbi.due_year = v_year and fbi.due_month = v_month
      and fbi.paid_at is null
      and greatest(fb.due_day, v_day_today) = v_day;
    v_balance := v_balance - v_amount;

    -- Parcelas de dívida não pagas deste mês — sem dia certo, contam
    -- inteiras hoje (decisão do usuário: mais conservador).
    if v_day = v_day_today then
      select coalesce(sum(amount), 0) into v_amount
      from debt_installments
      where user_id = auth.uid()
        and due_year = v_year and due_month = v_month
        and paid_at is null;
      v_balance := v_balance - v_amount;
    end if;

    -- Fatura de cartão já fechada e ainda não paga (vencida conta hoje).
    select coalesce(sum(x.total), 0) into v_amount
    from (
      select
        (select coalesce(sum(t.amount), 0)
         from transactions t
         where t.user_id = auth.uid()
           and t.card_id = c.id
           and t.type = 'saida_variavel'
           and coalesce(t.is_expectation, false) = false
           and t.invoice_id is null
           and t.payment_date < _cycle_start(c.closing_day)) as total,
        _cycle_due_date(c.closing_day, c.due_day) as due_date
      from credit_cards c
      where c.user_id = auth.uid()
    ) x
    where x.total > 0
      and extract(year from x.due_date)::int = v_year
      and extract(month from x.due_date)::int = v_month
      and greatest(extract(day from x.due_date)::int, v_day_today) = v_day;
    v_balance := v_balance - v_amount;

    -- Parcelas futuras de cartão já previstas com data exata neste dia.
    select coalesce(sum(t.amount), 0) into v_amount
    from transactions t
    where t.user_id = auth.uid()
      and t.card_purchase_id is not null
      and t.is_expectation
      and t.payment_date = make_date(v_year, v_month, v_day);
    v_balance := v_balance - v_amount;

    -- Entradas esperadas do planejamento, a partir de hoje.
    select coalesce(sum(pii.amount), 0) into v_amount
    from plan_income_items pii
    join monthly_plans mp on mp.id = pii.plan_id
    where mp.month_id = p_month_id
      and pii.user_id = auth.uid()
      and pii.expected_day = v_day;
    v_balance := v_balance + v_amount;

    if v_balance < 0 and v_first_day is null then
      v_first_day     := v_day;
      v_first_balance := v_balance;
    end if;
  end loop;

  if v_first_day is null then
    return null;
  end if;

  select min(pii.expected_day) into v_next_income_day
  from plan_income_items pii
  join monthly_plans mp on mp.id = pii.plan_id
  where mp.month_id = p_month_id
    and pii.user_id = auth.uid()
    and pii.expected_day > v_first_day;

  return json_build_object(
    'day', v_first_day,
    'balance', v_first_balance,
    'next_income_day', v_next_income_day
  );
end;
$$;

grant execute on function get_balance_projection(bigint) to authenticated;

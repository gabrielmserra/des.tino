-- =====================================================================
-- Aporte/resgate de investimento (aplicação numa caixinha/CDB/Tesouro,
-- ou seu resgate de volta pra conta) deixa de contar nos cards
-- "Entradas" e "Saídas" do mês -- é dinheiro que só mudou de lugar,
-- não renda nem gasto de verdade. "Saldo", "Saldo projetado" e "Saldo
-- acumulado" CONTINUAM somando tudo, sem nenhuma exclusão -- pedido
-- explícito do usuário: se você resgata R$100 de um investimento, esse
-- R$100 é dinheiro real que chegou na conta corrente, e o saldo do app
-- precisa refletir isso pra bater com o saldo real do banco.
--
-- Ao contrário de uma tentativa anterior (revertida), a marcação NÃO
-- usa a categoria "Investimentos" (texto livre, editável em qualquer
-- lançamento, gatilho frágil) -- usa uma coluna booleana nova,
-- is_investment_movement, setada só pelo código no momento da
-- importação/detecção (nunca por escolha manual de categoria editando
-- um lançamento). Também corrige o bug que causava a assimetria: hoje
-- um resgate (entrada) importado sempre cai como categoria "Receita",
-- mesmo quando a detecção já identificou como investimento -- só o
-- aporte (saída) usa a categoria sugerida corretamente.
--
-- Não cria nada na aba Investimentos, não mexe em investment_movements
-- -- é sobre transactions vindas da importação de extrato, um caminho
-- separado da aba Investimentos.
--
-- Rodar no SQL Editor do Supabase (após 001-040).
-- =====================================================================

alter table transactions add column if not exists is_investment_movement boolean not null default false;

-- ── Backfill retroativo (roda uma vez, nesta migração) ────────────────

do $$
declare
  v_step1 int;
  v_step2 int;
begin
  -- Passo 1: aportes já categorizados corretamente hoje.
  update transactions
  set is_investment_movement = true
  where category = 'Investimentos'
    and is_investment_movement = false;
  get diagnostics v_step1 = row_count;

  -- Passo 2: qualquer lançamento (aporte OU resgate, ainda não marcado)
  -- que bate no mesmo padrão de descrição usado pela detecção automática
  -- (parsers/base.py:_INVESTMENT_KEYWORDS / web/src/lib/parsers/base.ts) --
  -- cobre os resgates que caíram como "Receita" por causa do bug, e
  -- corrige a categoria deles junto, pro histórico sair coerente nos
  -- dois eixos (categoria E marcação estrutural) de uma vez.
  update transactions
  set is_investment_movement = true,
      category = 'Investimentos'
  where is_investment_movement = false
    and type in ('entrada_fixa', 'entrada_variavel', 'saida_fixa', 'saida_variavel')
    and (
      description ilike '%TESOURO DIRETO%'        or
      description ilike '%APLICACAO%'              or
      description ilike '%APLICAÇÃO%'              or
      description ilike '%RESGATE%'                or
      description ilike '%CDB%'                    or
      description ilike '%LCI%'                    or
      description ilike '%LCA%'                    or
      description ilike '%FUNDO DE INVESTIMENTO%'  or
      description ilike '%SELIC%'
    );
  get diagnostics v_step2 = row_count;

  raise notice 'is_investment_movement backfill: % já categorizados + % achados por palavra-chave (categoria corrigida)', v_step1, v_step2;
end $$;

-- ── get_month_summary: dois conjuntos de totais ───────────────────────

create or replace function get_month_summary(p_month_id bigint)
returns json
language plpgsql
stable
as $$
declare
  -- "Exibição" (cards Entradas/Saídas) -- pula is_investment_movement
  disp_ef numeric := 0; disp_ev numeric := 0; disp_sf numeric := 0; disp_sv numeric := 0;
  -- "Completo" (Saldo) -- inclui tudo, igual sempre foi
  full_ef numeric := 0; full_ev numeric := 0; full_sf numeric := 0; full_sv numeric := 0;
  proj_ef numeric := 0; proj_ev numeric := 0; proj_sf numeric := 0; proj_sv numeric := 0;
  n_exp int := 0;
  inv_net numeric := 0;
  total_entradas numeric; total_saidas numeric; saldo numeric;
  full_entradas numeric; full_saidas numeric;
  proj_entradas numeric; proj_saidas numeric; saldo_projetado numeric;
  saldo_acumulado numeric;
  r record;
begin
  for r in
    select type,
           coalesce(amount, 0) as amount,
           card_id, benefit_id,
           coalesce(is_investment_movement, false) as is_inv,
           coalesce(is_expectation, false) as is_exp
    from transactions
    where month_id = p_month_id
  loop
    if r.type not in ('entrada_fixa', 'entrada_variavel', 'saida_fixa', 'saida_variavel') then
      continue;
    end if;
    if r.card_id is not null and r.type = 'saida_variavel' then
      continue;
    end if;
    if r.benefit_id is not null and r.type in ('saida_fixa', 'saida_variavel') then
      continue;
    end if;

    if r.is_exp then
      n_exp := n_exp + 1;
      if    r.type = 'entrada_fixa'     then proj_ef := proj_ef + r.amount;
      elsif r.type = 'entrada_variavel' then proj_ev := proj_ev + r.amount;
      elsif r.type = 'saida_fixa'       then proj_sf := proj_sf + r.amount;
      elsif r.type = 'saida_variavel'   then proj_sv := proj_sv + r.amount;
      end if;
    else
      -- Completo: sempre soma (alimenta o Saldo)
      if    r.type = 'entrada_fixa'     then full_ef := full_ef + r.amount;
      elsif r.type = 'entrada_variavel' then full_ev := full_ev + r.amount;
      elsif r.type = 'saida_fixa'       then full_sf := full_sf + r.amount;
      elsif r.type = 'saida_variavel'   then full_sv := full_sv + r.amount;
      end if;

      -- Exibição: pula aporte/resgate de investimento (alimenta os cards)
      if r.is_inv then
        continue;
      end if;
      if    r.type = 'entrada_fixa'     then disp_ef := disp_ef + r.amount;
      elsif r.type = 'entrada_variavel' then disp_ev := disp_ev + r.amount;
      elsif r.type = 'saida_fixa'       then disp_sf := disp_sf + r.amount;
      elsif r.type = 'saida_variavel'   then disp_sv := disp_sv + r.amount;
      end if;
    end if;
  end loop;

  inv_net := get_month_investment_net(p_month_id);

  total_entradas  := disp_ef + disp_ev;
  total_saidas    := disp_sf + disp_sv;
  full_entradas   := full_ef + full_ev;
  full_saidas     := full_sf + full_sv;
  saldo           := full_entradas - full_saidas;
  proj_entradas   := full_entradas + proj_ef + proj_ev;
  proj_saidas     := full_saidas   + proj_sf + proj_sv;
  saldo_projetado := proj_entradas - proj_saidas;
  saldo_acumulado := get_saldo_acumulado(p_month_id);

  return json_build_object(
    'entrada_fixa', disp_ef, 'entrada_variavel', disp_ev,
    'saida_fixa', disp_sf, 'saida_variavel', disp_sv,
    'total_entradas', total_entradas,
    'total_saidas', total_saidas,
    'total_investimentos', inv_net,
    'saldo', saldo,
    'saldo_projetado', saldo_projetado,
    'saldo_acumulado', saldo_acumulado,
    'n_expectations', n_exp,
    'has_expectations', n_exp > 0
  );
end;
$$;

grant execute on function get_month_summary(bigint) to authenticated;

-- ── import_transactions_bulk: novo campo p_rows[].is_investment_movement ──

create or replace function import_transactions_bulk(p_rows jsonb)
returns setof bigint
language plpgsql
as $$
declare
  r record;
  v_id bigint;
begin
  for r in
    select * from jsonb_to_recordset(p_rows) as x(
      month_id       bigint,
      type           text,
      description    text,
      amount         numeric,
      category       text,
      payment_method text,
      payment_date   date,
      payment_time   time,
      card_id        bigint,
      benefit_id     bigint,
      debit_card_id  bigint,
      import_raw     text,
      is_investment_movement boolean
    )
  loop
    v_id := add_transaction(
      r.month_id, r.type, r.description, r.amount, r.category,
      r.card_id, r.benefit_id, false, r.debit_card_id, r.payment_method,
      r.payment_date, r.payment_time
    );
    update transactions
    set imported = true,
        import_raw = r.import_raw,
        is_investment_movement = coalesce(r.is_investment_movement, false)
    where id = v_id;
    return next v_id;
  end loop;
end;
$$;

grant execute on function import_transactions_bulk(jsonb) to authenticated;

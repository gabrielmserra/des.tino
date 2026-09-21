-- =====================================================================
-- Dados brutos pro Guru Financeiro detectar assinatura/conta fixa
-- parada ou divergente do extrato: cruza contas fixas ativas com
-- lançamentos importados recentes. A comparação de texto em si (nome
-- da conta ~ descrição do extrato, agrupar recorrências) roda no
-- cliente (mesmo motor de tips.ts/_build_tips) -- esta função só
-- entrega os dois conjuntos de dados já filtrados, pra não trafegar
-- lançamento nenhum, categoria nenhuma além do necessário.
--
-- p_months (default 2): janela de lançamentos importados considerada,
-- e também usado pra não sinalizar conta fixa criada há menos tempo
-- que isso (created_at) -- evita falso alarme "sumiu do extrato" numa
-- conta que acabou de ser cadastrada e ainda não teve tempo de
-- aparecer numa nova importação.
--
-- Rodar no SQL Editor do Supabase (após 001-041).
-- =====================================================================

create or replace function get_fixed_bill_watch_data(p_months int default 2)
returns json
language sql
stable
as $$
  select json_build_object(
    'bills', (
      select coalesce(json_agg(json_build_object(
        'id', id,
        'name', name,
        'amount', expected_amount
      )), '[]'::json)
      from fixed_bills
      where user_id = auth.uid()
        and active
        and created_at < now() - (greatest(p_months, 1) || ' months')::interval
    ),
    'transactions', (
      select coalesce(json_agg(json_build_object(
        'description', coalesce(import_raw, description),
        'amount', amount,
        'payment_date', payment_date
      )), '[]'::json)
      from transactions
      where user_id = auth.uid()
        and imported
        and type in ('saida_fixa', 'saida_variavel')
        and coalesce(is_expectation, false) = false
        and payment_date is not null
        and payment_date >= (current_date - (greatest(p_months, 1) || ' months')::interval)
    )
  );
$$;

grant execute on function get_fixed_bill_watch_data(int) to authenticated;

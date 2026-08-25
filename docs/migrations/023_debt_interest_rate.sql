-- =====================================================================
-- Taxa de juros mensal opcional em Dívidas — usada pra financiamento
-- (carro, imóvel). Só armazena a taxa pra exibição/referência: quem
-- calcula as parcelas pela Tabela Price é o cliente (desktop/web) antes
-- de chamar create_debt — o valor das parcelas continua vindo pronto em
-- p_installments, só precisamos persistir a taxa junto.
--
-- Rodar no SQL Editor do Supabase (após 001-022).
-- =====================================================================

alter table debts add column if not exists interest_rate numeric;

-- Assinatura muda (7º parâmetro) — precisa dropar a versão antiga de 6
-- argumentos primeiro, senão o Postgres cria um overload novo em vez de
-- substituir (mesmo padrão usado na migration 021 pra pay_installment).
drop function if exists create_debt(text, text, numeric, text, text, jsonb);

create or replace function create_debt(
  p_description   text,
  p_creditor      text,
  p_total_amount  numeric,
  p_category      text,
  p_notes         text,
  p_installments  jsonb,
  p_interest_rate numeric default null
) returns bigint
language plpgsql
as $$
declare
  v_debt_id bigint;
  v_item    jsonb;
begin
  insert into debts (user_id, description, creditor, total_amount, category, notes, interest_rate)
  values (auth.uid(), p_description, p_creditor, p_total_amount,
          coalesce(p_category, 'Dívidas'), p_notes, p_interest_rate)
  returning id into v_debt_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb))
  loop
    insert into debt_installments (
      debt_id, user_id, installment_number, amount, due_year, due_month
    ) values (
      v_debt_id, auth.uid(),
      (v_item->>'number')::int,
      (v_item->>'amount')::numeric,
      (v_item->>'year')::int,
      (v_item->>'month')::int
    );
  end loop;

  return v_debt_id;
end;
$$;

grant execute on function create_debt(text, text, numeric, text, text, jsonb, numeric) to authenticated;

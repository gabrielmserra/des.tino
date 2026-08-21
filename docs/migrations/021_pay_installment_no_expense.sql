-- =====================================================================
-- pay_installment não lança mais gasto nem mexe no saldo — vira só um
-- checklist ("Pagar" marca a parcela como paga, ponto). Decisão do
-- usuário: dívida paga não é a mesma coisa que dinheiro saindo da conta
-- pelo app; quem quiser refletir isso no saldo lança manualmente.
--
-- Substitui a versão da migration 010 (que tinha o parâmetro
-- p_launch_expense e inseria em transactions).
--
-- Rodar no SQL Editor do Supabase (após 001-020).
-- =====================================================================

drop function if exists pay_installment(bigint, boolean);

create or replace function pay_installment(p_inst_id bigint)
returns void
language plpgsql
as $$
begin
  update debt_installments
  set paid_at = now(), expense_id = null
  where id = p_inst_id;
end;
$$;

grant execute on function pay_installment(bigint) to authenticated;

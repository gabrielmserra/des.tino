-- =====================================================================
-- Corrige a deteccao de duplicata (v4.3.1) quebrando pra lancamentos
-- renomeados depois de importados: a checagem compara a descricao SALVA
-- com a descricao NOVA sendo importada -- uma vez que o usuario renomeia
-- um lancamento (ex.: "SL MARECHAL CURITIBA BRA" -> "Loja XV de
-- Novembro", um uso normal e esperado do app), a descricao salva nao
-- tem mais nada a ver com o texto bruto do banco, e reimportar o mesmo
-- extrato/fatura nao reconhece mais como duplicata.
--
-- Adiciona uma coluna import_raw: guarda a descricao exatamente como o
-- parser leu na hora da importacao, ANTES de qualquer edicao do
-- usuario (na revisao da importacao ou depois, editando o lancamento) --
-- nunca mais e alterada. A checagem de duplicata passa a comparar
-- contra import_raw (quando existe) em vez de description, sobrevivendo
-- a renomeacoes. Lancamentos manuais (sem import_raw) e importados
-- antes desta migration continuam comparando por description mesmo
-- (fallback).
--
-- Rodar no SQL Editor do Supabase (apos 001-037).
-- =====================================================================

alter table transactions add column if not exists import_raw text;

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
      import_raw     text
    )
  loop
    v_id := add_transaction(
      r.month_id, r.type, r.description, r.amount, r.category,
      r.card_id, r.benefit_id, false, r.debit_card_id, r.payment_method,
      r.payment_date, r.payment_time
    );
    update transactions set imported = true, import_raw = r.import_raw where id = v_id;
    return next v_id;
  end loop;
end;
$$;

grant execute on function import_transactions_bulk(jsonb) to authenticated;

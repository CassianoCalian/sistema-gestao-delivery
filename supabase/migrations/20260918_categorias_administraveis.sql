-- =========================================================
-- CATEGORIAS ADMINISTRAVEIS
-- =========================================================

alter table public.categorias
add column if not exists icone text not null default '🛍️';

alter table public.categorias
add column if not exists descricao text;

create unique index if not exists categorias_nome_unique
on public.categorias (lower(nome));

create unique index if not exists categorias_slug_unique
on public.categorias (lower(slug));

-- Identidade inicial das categorias já existentes
update public.categorias
set
  icone = case slug
    when 'cervejas' then '🍺'
    when 'destilados' then '🥃'
    when 'energeticos' then '⚡'
    when 'refrigerantes' then '🥤'
    when 'aguas' then '💧'
    when 'gelos' then '🧊'
    when 'copos-e-acessorios' then '🥤'
    when 'combos' then '🔥'
    when 'promocoes' then '🏷️'
    when 'vinhos' then '🍷'
    when 'vinho' then '🍷'
    else coalesce(nullif(icone, ''), '🛍️')
  end,

  descricao = case slug
    when 'cervejas' then 'Geladas e trincando'
    when 'destilados' then 'Para todos os brindes'
    when 'energeticos' then 'Energia pra noite'
    when 'refrigerantes' then 'Sempre geladinhos'
    when 'aguas' then 'Sempre à mão'
    when 'gelos' then 'Do jeito que precisa'
    when 'copos-e-acessorios' then 'Tudo para acompanhar'
    when 'combos' then 'Mais por menos'
    when 'promocoes' then 'Ofertas especiais'
    when 'vinhos' then 'Vinhos para todos os momentos'
    when 'vinho' then 'Vinhos para todos os momentos'
    else coalesce(descricao, 'Confira nossas opções')
  end;

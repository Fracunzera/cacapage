-- Número de cada caca pública: "tu caca es la N.º 100 del mapa público".
-- Correlativo y fijo: despublicar una no corre los números de las demás.
create sequence publicaciones_numero;
alter table publicaciones add column numero bigint;
update publicaciones p set numero = o.n
	from (select id, row_number() over (order by visible_desde, id) as n from publicaciones) o
	where o.id = p.id;
select setval('publicaciones_numero', coalesce((select max(numero) from publicaciones), 0) + 1, false);
alter table publicaciones alter column numero set default nextval('publicaciones_numero');
alter table publicaciones alter column numero set not null;
alter sequence publicaciones_numero owned by publicaciones.numero;

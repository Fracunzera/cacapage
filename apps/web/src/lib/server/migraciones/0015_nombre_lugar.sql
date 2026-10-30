-- El nombre propio que el dueño le puso al lugar ("Casa de la abuela"). Lo ven
-- solo los amigos: nunca va al mapa público (podría nombrar a una persona).
alter table publicaciones add column lugar_nombre text check (char_length(lugar_nombre) <= 60);
alter table publicaciones add constraint publicaciones_lugar_nombre_amigos check (lugar_nombre is null or alcance = 'amigos');

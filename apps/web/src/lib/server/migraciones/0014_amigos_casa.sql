-- Casa, laburo y lo de alguien se pueden compartir con amigos (PRIVACY.md P-43),
-- nunca en el mapa público: la base lo impide aunque la app se equivoque.
alter table publicaciones drop constraint publicaciones_tipo_check;
alter table publicaciones add constraint publicaciones_tipo_check check (
	tipo in ('banio_publico', 'ruta', 'naturaleza', 'otro')
	or (alcance = 'amigos' and tipo in ('casa', 'laburo', 'casa_ajena'))
);

-- La llave de la bóveda en custodia del servidor (PRIVACY.md P-40): envuelta con
-- una llave que sale de PIMIENTA_MAIL (en el .env, no en la base). Así el
-- historial vuelve solo al entrar, con cualquier método, sin código.
alter table boveda_llaves drop constraint boveda_llaves_metodo_check;
alter table boveda_llaves add constraint boveda_llaves_metodo_check
	check (metodo in ('recuperacion', 'passkey_prf', 'servidor'));

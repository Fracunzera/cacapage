-- Entrar con Google (PRIVACY.md P-39). Del lado de Google solo se pide `openid`:
-- se guarda una huella (HMAC con pimienta) del identificador, nunca mail ni nombre.
create table logins_google (
	cuenta_id uuid primary key references cuentas (id) on delete cascade,
	sub_hmac bytea not null unique,
	creado_en date not null default current_date
);

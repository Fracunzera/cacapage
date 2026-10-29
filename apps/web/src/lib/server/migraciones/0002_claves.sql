-- Contraseñas (opcional, además de passkey y mail). Solo se guarda la huella
-- scrypt con su sal y parámetros; la contraseña nunca.
create table claves (
	cuenta_id uuid primary key references cuentas (id) on delete cascade,
	huella text not null,
	actualizada_en date not null default current_date
);

-- Asociar un mail a una cuenta que ya existe (creada con passkey o contraseña).
-- El link confirma que el mail es de quien lo pide; recién ahí se guarda su HMAC.
alter table tokens_mail add column vincular_cuenta uuid references cuentas (id) on delete cascade;

-- Se ejecuta una sola vez, al crear el volumen de Postgres. La base de
-- producción (dondecague) la crea la imagen con POSTGRES_DB; acá va la de prueba,
-- separada: sus cuentas son descartables (DESIGN.md §15.2).
create database dondecague_prueba owner dondecague;

// Solo lectura (ADR 0001): consultas a Overpass, nunca a la API de edición de OSM.

/** Servidores públicos de Overpass, en orden. Si uno falla se prueba el siguiente. */
export const OVERPASS_POR_DEFECTO = [
	'https://overpass-api.de/api/interpreter',
	'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
	'https://overpass.private.coffee/api/interpreter'
];

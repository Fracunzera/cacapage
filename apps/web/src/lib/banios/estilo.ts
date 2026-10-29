import { layers, namedFlavor } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/** Toda la Argentina (también es el recorte del PMTiles, docs/despliegue.md). Es el encuadre inicial, no un límite. */
export const ARGENTINA: [number, number, number, number] = [-73.6, -55.1, -53.6, -21.7];

/** Desde este zoom se dibuja encima el detalle de la Argentina (mundo.pmtiles llega hasta 8). */
export const ZOOM_DETALLE = 9;

/** Qué mapas base hay en el servidor. */
export interface Teselas {
	argentina: boolean;
	mundo: boolean;
}

const ATRIBUCION =
	'<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>';

/** Capas de Protomaps para una fuente; con `prefijo`, sin fondo y desde `minzoom`. */
function capas(fuente: string, prefijo = '', minzoom = 0): LayerSpecification[] {
	return layers(fuente, namedFlavor('light'), { lang: 'es' })
		.filter((c) => !(prefijo && c.type === 'background'))
		.map((c) => ({ ...c, id: prefijo + c.id, ...(minzoom ? { minzoom: Math.max(minzoom, c.minzoom ?? 0) } : {}) }) as LayerSpecification);
}

/**
 * Estilo del mapa base, todo desde nuestro dominio (PRIVACY.md P-16): el mundo
 * de fondo en todos los zooms y, encima, la Argentina con cada calle desde el
 * zoom 9. Si falta uno, se usa el otro; si faltan los dos, fondo liso.
 */
export function estiloBase(origen: string, teselas: Teselas): StyleSpecification {
	if (!teselas.argentina && !teselas.mundo)
		return {
			version: 8,
			sources: {},
			layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#f4ecdf' } }]
		};
	const fuente = (archivo: string) => ({ type: 'vector' as const, url: `pmtiles://${origen}/tiles/${archivo}.pmtiles`, attribution: ATRIBUCION });
	return {
		version: 8,
		glyphs: `${origen}/mapa/fuentes/{fontstack}/{range}.pbf`,
		sprite: `${origen}/mapa/sprites/light`,
		sources: {
			...(teselas.mundo ? { mundo: fuente('mundo') } : {}),
			...(teselas.argentina ? { argentina: fuente('argentina') } : {})
		},
		layers:
			teselas.mundo && teselas.argentina
				? [...capas('mundo'), ...capas('argentina', 'ar-', ZOOM_DETALLE)]
				: capas(teselas.mundo ? 'mundo' : 'argentina')
	};
}

/** Pregunta qué archivos de teselas hay (un byte de cada uno). */
export async function detectarTeselas(): Promise<Teselas> {
	const hay = (archivo: string) =>
		fetch(`/tiles/${archivo}.pmtiles`, { headers: { range: 'bytes=0-0' } }).then(
			(r) => r.ok,
			() => false
		);
	const [argentina, mundo] = await Promise.all([hay('argentina'), hay('mundo')]);
	return { argentina, mundo };
}

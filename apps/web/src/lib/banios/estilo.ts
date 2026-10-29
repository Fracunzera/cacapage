import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';

/** Toda la Argentina (también es el recorte del PMTiles, docs/despliegue.md). */
export const ARGENTINA: [number, number, number, number] = [-73.6, -55.1, -53.6, -21.7];

/**
 * Estilo del mapa base. Todo se sirve desde nuestro dominio: teselas, fuentes
 * y sprites (PRIVACY.md P-16, sin orígenes de terceros).
 */
export function estiloBase(origen: string, conTeselas: boolean): StyleSpecification {
	if (!conTeselas)
		return {
			version: 8,
			sources: {},
			layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#f4ecdf' } }]
		};
	return {
		version: 8,
		glyphs: `${origen}/mapa/fuentes/{fontstack}/{range}.pbf`,
		sprite: `${origen}/mapa/sprites/light`,
		sources: {
			protomaps: {
				type: 'vector',
				url: `pmtiles://${origen}/tiles/argentina.pmtiles`,
				attribution:
					'<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>'
			}
		},
		layers: layers('protomaps', namedFlavor('light'), { lang: 'es' })
	};
}

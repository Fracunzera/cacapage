// Mapa base compartido por "Mi mapa" y el mapa de cacas: MapLibre (build CSP),
// teselas propias y fuentes propias (PRIVACY.md P-16).
import type { Map as Mapa } from 'maplibre-gl';
import urlTrabajador from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
import { ARGENTINA, detectarTeselas, estiloBase, type Teselas } from './estilo';

let protocolo = false;

export async function crearMapa(contenedor: HTMLElement): Promise<{ mapa: Mapa; teselas: Teselas }> {
	const [{ default: maplibregl }, { Protocol }, teselas] = await Promise.all([
		import('maplibre-gl/dist/maplibre-gl-csp.js'),
		import('pmtiles'),
		detectarTeselas()
	]);
	if (!protocolo) {
		maplibregl.setWorkerUrl(urlTrabajador);
		maplibregl.addProtocol('pmtiles', new Protocol().tile);
		protocolo = true;
	}
	const mapa = new maplibregl.Map({
		container: contenedor,
		style: estiloBase(location.origin, teselas),
		bounds: ARGENTINA,
		attributionControl: { compact: true },
		locale: {
			'NavigationControl.ZoomIn': 'Acercar',
			'NavigationControl.ZoomOut': 'Alejar',
			'AttributionControl.ToggleAttribution': 'Créditos'
		}
	});
	mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
	await new Promise<void>((ok) => mapa.once('load', () => ok()));
	return { mapa, teselas };
}

/** Encuadra los puntos; con uno solo, acerca a nivel de barrio. */
export function encuadrar(mapa: Mapa, puntos: { lat: number; lon: number }[]): void {
	if (!puntos.length) return;
	const lats = puntos.map((p) => p.lat);
	const lons = puntos.map((p) => p.lon);
	if (puntos.length === 1) mapa.jumpTo({ center: [lons[0], lats[0]], zoom: 14 });
	else
		mapa.fitBounds(
			[
				[Math.min(...lons), Math.min(...lats)],
				[Math.max(...lons), Math.max(...lats)]
			],
			{ padding: 60, maxZoom: 15, duration: 0 }
		);
}

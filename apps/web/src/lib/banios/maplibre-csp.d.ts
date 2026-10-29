// El build "csp" de MapLibre no usa blob: ni eval; expone la misma API.
declare module 'maplibre-gl/dist/maplibre-gl-csp.js' {
	import maplibregl from 'maplibre-gl';
	export default maplibregl;
}

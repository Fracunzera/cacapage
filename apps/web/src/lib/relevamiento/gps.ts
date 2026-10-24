// Seguimiento de GPS para el relevamiento. Se usa watchPosition y no
// getCurrentPosition porque la precisión mejora con los segundos: la primera
// lectura suele venir de wifi, con decenas de metros de error.

export interface Lectura {
	lat: number;
	lon: number;
	precision_m: number;
	fix_en: string;
}

export type ErrorGps = 'sin_soporte' | 'permiso_denegado' | 'no_disponible';

export function seguirGps(alLeer: (l: Lectura) => void, alFallar: (e: ErrorGps) => void): () => void {
	if (!('geolocation' in navigator)) {
		alFallar('sin_soporte');
		return () => {};
	}
	let id: number | null = null;
	let detenido = false;

	const iniciar = () => {
		id = navigator.geolocation.watchPosition(
			(p) =>
				alLeer({
					lat: p.coords.latitude,
					lon: p.coords.longitude,
					precision_m: p.coords.accuracy,
					fix_en: new Date(p.timestamp).toISOString()
				}),
			(e) => {
				if (e.code === e.PERMISSION_DENIED) {
					alFallar('permiso_denegado');
					return;
				}
				// Timeout o señal perdida: se reinicia el seguimiento, que en algunos
				// navegadores se corta después de un error.
				alFallar('no_disponible');
				if (id !== null) navigator.geolocation.clearWatch(id);
				if (!detenido) setTimeout(() => !detenido && iniciar(), 2000);
			},
			{ enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
		);
	};
	iniciar();

	return () => {
		detenido = true;
		if (id !== null) navigator.geolocation.clearWatch(id);
	};
}

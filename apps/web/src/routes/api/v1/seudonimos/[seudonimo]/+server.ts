import { json } from '@sveltejs/kit';
import { problemaSeudonimo } from '$lib/cuentas/validacion';
import { seudonimoLibre } from '$lib/server/auth/cuentas';
import { limitarPorIp } from '$lib/server/http';

export const GET = async (event) => {
	limitarPorIp(event, 'seudonimo', 60, 60_000);
	const s = event.params.seudonimo;
	const problema = problemaSeudonimo(s);
	if (problema) return json({ disponible: false, problema });
	return json({ disponible: await seudonimoLibre(s) });
};

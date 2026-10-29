import { cerrarSesion } from '$lib/server/auth/sesiones';
import { sinContenido } from '$lib/server/http';

export const POST = async ({ cookies }) => {
	await cerrarSesion(cookies);
	return sinContenido();
};

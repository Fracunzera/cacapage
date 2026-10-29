import { json } from '@sveltejs/kit';
import { cfg } from '$lib/server/config';
import { ENTORNO } from '$lib/server/entorno';
import { mailDisponible } from '$lib/server/auth/mail';

export const GET = () => json({ entorno: ENTORNO, passkeys: cfg().passkeys, mail: mailDisponible() });

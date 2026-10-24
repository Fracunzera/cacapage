import type { RequestHandler } from './$types';

// Sin Disallow, a propósito: en prueba la indexación se corta con X-Robots-Tag,
// y Google tiene que poder rastrear para leerlo (DESIGN.md §15.3).
export const GET: RequestHandler = () =>
	new Response('User-agent: *\nAllow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

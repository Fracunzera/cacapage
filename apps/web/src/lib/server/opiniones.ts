import { error } from '@sveltejs/kit';
import { db } from './db';

const ID = /^[nwr]\d{1,20}$/;

/** El baño tiene que existir y estar a la vista. */
export async function exigirBanio(id: string): Promise<void> {
	if (!ID.test(id)) error(400, 'Baño inválido.');
	const [b] = await db()`select 1 from osm.candidatos c where c.id = ${id}
		and not exists (select 1 from banios_ocultos o where o.banio_id = c.id)`;
	if (!b) error(404, 'Ese baño no está en el mapa.');
}

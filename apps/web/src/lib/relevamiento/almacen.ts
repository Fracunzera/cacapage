// Persistencia del relevamiento en IndexedDB. Se escribe en cada cambio, no al
// final: si el navegador se cierra en la vereda, no se pierde lo cargado.
import type { BanioRelevado, Borrador } from './modelo';

const NOMBRE_DB = 'cacapage-relevamiento';
const VERSION_DB = 1;
const BORRADOR = 'borrador';
const RELEVADOS = 'relevados';
const CLAVE_BORRADOR = 'actual';

export interface Almacen {
	leerBorrador(): Promise<Borrador | undefined>;
	guardarBorrador(b: Borrador): Promise<void>;
	/** Guarda el baño y descarta el borrador en una sola transacción. */
	confirmar(relevado: BanioRelevado): Promise<void>;
	listar(): Promise<BanioRelevado[]>;
	borrar(id: string): Promise<void>;
	cerrar(): void;
}

function pedido<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((ok, mal) => {
		req.onsuccess = () => ok(req.result);
		req.onerror = () => mal(req.error);
	});
}

function terminada(tx: IDBTransaction): Promise<void> {
	return new Promise((ok, mal) => {
		tx.oncomplete = () => ok();
		tx.onerror = () => mal(tx.error);
		tx.onabort = () => mal(tx.error ?? new Error('Transacción abortada'));
	});
}

export async function abrirAlmacen(fabrica: IDBFactory = indexedDB): Promise<Almacen> {
	const abrir = fabrica.open(NOMBRE_DB, VERSION_DB);
	abrir.onupgradeneeded = () => {
		const db = abrir.result;
		if (!db.objectStoreNames.contains(BORRADOR)) db.createObjectStore(BORRADOR);
		if (!db.objectStoreNames.contains(RELEVADOS)) db.createObjectStore(RELEVADOS, { keyPath: 'id' });
	};
	const db = await pedido(abrir);

	// 'strict': la transacción termina recién cuando el dato está en disco.
	const escribir = (tiendas: string[]) => db.transaction(tiendas, 'readwrite', { durability: 'strict' });

	return {
		async leerBorrador() {
			const tx = db.transaction(BORRADOR, 'readonly');
			return (await pedido(tx.objectStore(BORRADOR).get(CLAVE_BORRADOR))) as Borrador | undefined;
		},
		async guardarBorrador(b) {
			const tx = escribir([BORRADOR]);
			tx.objectStore(BORRADOR).put(structuredClone(b), CLAVE_BORRADOR);
			await terminada(tx);
		},
		async confirmar(relevado) {
			const tx = escribir([BORRADOR, RELEVADOS]);
			tx.objectStore(RELEVADOS).put(structuredClone(relevado));
			tx.objectStore(BORRADOR).delete(CLAVE_BORRADOR);
			await terminada(tx);
		},
		async listar() {
			const tx = db.transaction(RELEVADOS, 'readonly');
			const todos = (await pedido(tx.objectStore(RELEVADOS).getAll())) as BanioRelevado[];
			return todos.sort((a, b) => b.relevado_en.localeCompare(a.relevado_en));
		},
		async borrar(id) {
			const tx = escribir([RELEVADOS]);
			tx.objectStore(RELEVADOS).delete(id);
			await terminada(tx);
		},
		cerrar() {
			db.close();
		}
	};
}

// Historial cifrado: copia local en IndexedDB + sincronización con el servidor
// (DESIGN.md §6.1 y §6.2). Se guarda primero en el celular y después se sube:
// sin conexión, el registro queda pendiente y se sube la próxima vez.
import { api, ErrorApi } from '$lib/cliente/api';
import { cifrarPagina, derivarLlaves, descifrarPagina, idPagina, type Llaves } from './cripto';
import { evaluarPremios, generalVacia, mesDe, mezclar, type Novedad, type Pagina, type PaginaGeneral, type PaginaMes, type Registro } from './modelo';

const NOMBRE_DB = 'dondecague-boveda';
const META = 'meta';
const PAGINAS = 'paginas';

interface PaginaLocal {
	id: string;
	version: number;
	contenido: Pagina;
	/** Cambiada acá y todavía no subida. */
	sucia: boolean;
}

interface PaginaRemota {
	pagina_id: string;
	seq: number;
	version: number;
	nonce: string;
	cifrado: string;
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

async function abrirDb(fabrica: IDBFactory): Promise<IDBDatabase> {
	const abrir = fabrica.open(NOMBRE_DB, 1);
	abrir.onupgradeneeded = () => {
		abrir.result.createObjectStore(META);
		abrir.result.createObjectStore(PAGINAS, { keyPath: 'id' });
	};
	return pedido(abrir);
}

export class Boveda {
	private paginas = new Map<string, PaginaLocal>();
	private llaves: Llaves | null = null;
	private seq = 0;

	private constructor(private db: IDBDatabase) {}

	/** Abre la copia local. Si era de otra cuenta, la borra. */
	static async abrir(seudonimo: string, fabrica: IDBFactory = indexedDB): Promise<Boveda> {
		let db = await abrirDb(fabrica);
		const dueno = await pedido(db.transaction(META).objectStore(META).get('cuenta'));
		if (dueno !== undefined && dueno !== seudonimo) {
			db.close();
			await Boveda.olvidar(fabrica);
			db = await abrirDb(fabrica);
		}
		const b = new Boveda(db);
		const tx = db.transaction([META, PAGINAS]);
		b.llaves = ((await pedido(tx.objectStore(META).get('llaves'))) as Llaves | undefined) ?? null;
		b.seq = ((await pedido(tx.objectStore(META).get('seq'))) as number | undefined) ?? 0;
		for (const p of (await pedido(tx.objectStore(PAGINAS).getAll())) as PaginaLocal[]) b.paginas.set(p.id, p);
		if (dueno === undefined) {
			const w = db.transaction(META, 'readwrite');
			w.objectStore(META).put(seudonimo, 'cuenta');
			await terminada(w);
		}
		return b;
	}

	/** Borra la copia local entera (al salir o al borrar la cuenta). */
	static async olvidar(fabrica: IDBFactory = indexedDB): Promise<void> {
		await new Promise<void>((ok) => {
			const r = fabrica.deleteDatabase(NOMBRE_DB);
			r.onsuccess = r.onerror = r.onblocked = () => ok();
		});
	}

	cerrar() {
		this.db.close();
	}

	get tieneLlaves() {
		return this.llaves !== null;
	}

	/** Deriva las llaves del secreto y las guarda (no exportables) en este celular. */
	async instalar(secreto: Uint8Array<ArrayBuffer>): Promise<void> {
		this.llaves = await derivarLlaves(secreto);
		const tx = this.db.transaction(META, 'readwrite', { durability: 'strict' });
		tx.objectStore(META).put(this.llaves, 'llaves');
		await terminada(tx);
	}

	private async persistir(paginas: PaginaLocal[], seq?: number): Promise<void> {
		const tx = this.db.transaction([META, PAGINAS], 'readwrite', { durability: 'strict' });
		for (const p of paginas) {
			tx.objectStore(PAGINAS).put(structuredClone(p));
			this.paginas.set(p.id, p);
		}
		if (seq !== undefined) {
			tx.objectStore(META).put(seq, 'seq');
			this.seq = seq;
		}
		await terminada(tx);
	}

	private exigirLlaves(): Llaves {
		if (!this.llaves) throw new Error('La bóveda no está abierta en este celular');
		return this.llaves;
	}

	/** Baja lo que cambió en otros dispositivos y lo mezcla con lo local. */
	async bajar(): Promise<void> {
		const llaves = this.exigirLlaves();
		const { paginas } = await api<{ paginas: PaginaRemota[] }>(`/boveda?desde=${this.seq}`);
		if (!paginas.length) return;
		const cambios: PaginaLocal[] = [];
		let seq = this.seq;
		for (const r of paginas) {
			seq = Math.max(seq, r.seq);
			const contenido = await descifrarPagina<Pagina>(llaves, r.nonce, r.cifrado);
			const local = this.paginas.get(r.pagina_id);
			if (local?.sucia) cambios.push({ ...local, version: r.version, contenido: mezclar(local.contenido, contenido) });
			else cambios.push({ id: r.pagina_id, version: r.version, contenido, sucia: false });
		}
		await this.persistir(cambios, seq);
	}

	/** Sube las páginas pendientes. Si otro dispositivo cambió una, baja, mezcla y reintenta. */
	async subir(): Promise<void> {
		const llaves = this.exigirLlaves();
		for (let intento = 0; intento < 4; intento++) {
			const sucias = [...this.paginas.values()].filter((p) => p.sucia);
			if (!sucias.length) return;
			let conflicto = false;
			for (const p of sucias) {
				try {
					const r = await api<{ version: number }>(`/boveda/paginas/${p.id}`, {
						metodo: 'PUT',
						cuerpo: { ...(await cifrarPagina(llaves, p.contenido)), version_esperada: p.version }
					});
					// Si la página cambió acá mientras subía, sigue sucia.
					const actual = this.paginas.get(p.id)!;
					await this.persistir([{ ...actual, version: r.version, sucia: actual.contenido !== p.contenido }]);
				} catch (e) {
					if (e instanceof ErrorApi && e.estado === 409) conflicto = true;
					else throw e;
				}
			}
			if (!conflicto) return;
			await this.bajar();
		}
	}

	/** Bajar y subir. Sin conexión no tira: lo local sigue valiendo. */
	async sincronizar(): Promise<boolean> {
		try {
			await this.bajar();
			await this.subir();
			return true;
		} catch (e) {
			if (e instanceof ErrorApi && e.estado === 0) return false;
			throw e;
		}
	}

	get pendientes(): number {
		return [...this.paginas.values()].filter((p) => p.sucia).length;
	}

	/** Registros vivos, del más nuevo al más viejo. */
	registros(): Registro[] {
		return [...this.paginas.values()]
			.flatMap((p) => (p.contenido.tipo === 'mes' ? p.contenido.registros : []))
			.filter((r) => !r.borrado)
			.sort((a, b) => (a.ocurrido_en < b.ocurrido_en ? 1 : -1));
	}

	general(): PaginaGeneral {
		const g = [...this.paginas.values()].find((p) => p.contenido.tipo === 'general');
		return (g?.contenido as PaginaGeneral | undefined) ?? generalVacia();
	}

	private async pagina(nombre: string, vacia: () => Pagina): Promise<PaginaLocal> {
		const id = await idPagina(this.exigirLlaves(), nombre);
		return this.paginas.get(id) ?? { id, version: 0, contenido: vacia(), sucia: false };
	}

	/** Guarda (o actualiza) un registro y devuelve las medallas o logros nuevos. */
	async guardar(registro: Registro): Promise<Novedad[]> {
		// Copia plana: lo que llega de la interfaz puede ser un proxy reactivo, que IndexedDB no sabe guardar.
		const r = JSON.parse(JSON.stringify(registro)) as Registro;
		const mes = mesDe(r.ocurrido_en);
		const p = await this.pagina(mes, (): PaginaMes => ({ v: 1, tipo: 'mes', mes, registros: [] }));
		const contenido = mezclar(p.contenido as PaginaMes, { v: 1, tipo: 'mes', mes, registros: [r] });
		const cambios: PaginaLocal[] = [{ ...p, contenido, sucia: true }];
		this.paginas.set(p.id, cambios[0]);

		const g = await this.pagina('general', generalVacia);
		const { general, novedades } = evaluarPremios(g.contenido as PaginaGeneral, this.registros().length, r.actualizado_en);
		if (novedades.length) cambios.push({ ...g, contenido: general, sucia: true });
		await this.persistir(cambios);
		await this.sincronizar().catch(() => {});
		return novedades;
	}

	async borrar(r: Registro): Promise<void> {
		await this.guardar({ id: r.id, ocurrido_en: r.ocurrido_en, tipo: r.tipo, actualizado_en: new Date().toISOString(), borrado: true });
	}
}

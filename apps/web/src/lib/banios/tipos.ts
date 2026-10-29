/** Formato del catálogo de baños que sirve /api/v1/banios y usa el mapa. */

export type Categoria = 'banio' | 'estacion_servicio' | 'terminal' | 'aeropuerto' | 'shopping' | 'comercio' | 'otro';
export type Existencia = 'confirmado' | 'probable';

export interface Atributos {
	/** libre | clientes. Nunca "libre" para un comercio (PRIVACY.md P-32): eso se resuelve al mostrar. */
	acceso?: 'libre' | 'clientes';
	cobra?: boolean;
	accesible?: boolean | 'limitado';
	cambiador?: boolean;
	/** opening_hours de OSM, crudo. */
	horario?: string;
	direccion?: string;
	localidad?: string;
	operador?: string;
}

export interface Banio {
	id: string;
	categoria: Categoria;
	existencia: Existencia;
	nombre: string | null;
	marca: string | null;
	lat: number;
	lon: number;
	atributos: Atributos;
	/** YYYY-MM-DD: última modificación en OSM o check_date, lo más nuevo. */
	modificado: string | null;
}

export interface Catalogo {
	/** Base de datos de OSM de la que salió (timestamp de Overpass). */
	osm_base: string | null;
	importado_en: string | null;
	atribucion: string;
	banios: Banio[];
}

export const ATRIBUCION_OSM = '© colaboradores de OpenStreetMap (ODbL)';

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
	banio: 'Baño público',
	estacion_servicio: 'Estación de servicio',
	terminal: 'Terminal de ómnibus',
	aeropuerto: 'Aeropuerto',
	shopping: 'Shopping',
	comercio: 'Comercio',
	otro: 'Lugar con baño'
};

import { error } from '@sveltejs/kit';
import nodemailer from 'nodemailer';
import { cfg } from '../config';
import { ES_PRUEBA } from '../entorno';

export type TipoMail = 'entrada' | 'alta' | 'sin_cuenta' | 'vincular' | 'ya_asociado';

const TEXTOS: Record<TipoMail, { asunto: string; cuerpo: (url: string) => string }> = {
	entrada: {
		asunto: 'Tu link para entrar a Dónde Cagué',
		cuerpo: (url) =>
			`Tocá este link para entrar (vale 15 minutos y una sola vez):\n\n${url}\n\nSi no lo pediste vos, ignorá este mail: sin el link nadie puede entrar.`
	},
	alta: {
		asunto: 'Confirmá tu cuenta en Dónde Cagué',
		cuerpo: (url) =>
			`Tocá este link para crear tu cuenta (vale 15 minutos y una sola vez):\n\n${url}\n\nSi no la pediste vos, ignorá este mail y no se crea nada.`
	},
	vincular: {
		asunto: 'Confirmá tu mail en Dónde Cagué',
		cuerpo: (url) =>
			`Tocá este link para poder entrar a tu cuenta también con este mail (vale 15 minutos y una sola vez):\n\n${url}\n\nSi no lo pediste vos, ignorá este mail y no se asocia nada.`
	},
	ya_asociado: {
		asunto: 'Este mail ya tiene una cuenta en Dónde Cagué',
		cuerpo: (url) =>
			`Alguien (probablemente vos) quiso asociar este mail a una cuenta de Dónde Cagué, pero ya está asociado a otra cuenta. Un mail sirve para una sola cuenta.\n\nPara entrar con él: ${url}\n\nSi no fuiste vos, ignorá este mail.`
	},
	sin_cuenta: {
		asunto: 'No hay ninguna cuenta con este mail',
		cuerpo: (url) =>
			`Alguien (probablemente vos) quiso entrar a Dónde Cagué con este mail, pero no hay ninguna cuenta asociada.\n\nPara crear una: ${url}\n\nSi no fuiste vos, ignorá este mail.`
	}
};

let transporte: nodemailer.Transporter | null = null;

/**
 * El mail se usa solo para mandar el link y se descarta: no se guarda en la base
 * ni se escribe en logs (PRIVACY.md P-12).
 */
export const mailDisponible = () => cfg().mail.modo !== 'desactivado';

export async function enviarMail(destino: string, tipo: TipoMail, url: string): Promise<void> {
	const { asunto, cuerpo } = TEXTOS[tipo];
	const c = cfg();
	const asuntoFinal = ES_PRUEBA ? `[PRUEBA] ${asunto}` : asunto;
	if (c.mail.modo === 'desactivado') throw new Error('Mail desactivado');
	if (c.mail.modo === 'consola') {
		// Solo prueba o localhost (config.ts). Sin la dirección de destino.
		console.log(`[mail:${tipo}] ${url}`);
		return;
	}
	transporte ??= nodemailer.createTransport(c.mail.url);
	try {
		await transporte.sendMail({ from: c.mail.remitente, to: destino, subject: asuntoFinal, text: cuerpo(url) });
	} catch (e) {
		// Los errores de SMTP suelen incluir la dirección de destino: al log va solo
		// el código, nunca el mensaje completo (PRIVACY.md P-12, P-19).
		const { code, responseCode } = e as { code?: string; responseCode?: number };
		console.error(`[mail:${tipo}] fallo de envío: ${code ?? 'sin código'} ${responseCode ?? ''}`.trim());
		error(502, 'No pudimos mandar el mail. Probá de nuevo en un rato.');
	}
}

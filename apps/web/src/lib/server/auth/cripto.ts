import { createHash, createHmac, randomBytes } from 'node:crypto';
import { normalizarMail } from '$lib/cuentas/validacion';
import { cfg } from '../config';

export const tokenAleatorio = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest();

/** El mail nunca se guarda en claro (PRIVACY.md P-12). */
export const hmacMail = (mail: string) => createHmac('sha256', cfg().pimientaMail).update(normalizarMail(mail)).digest();

/** El identificador de Google tampoco se guarda en claro (PRIVACY.md P-39). */
export const hmacGoogle = (sub: string) => createHmac('sha256', cfg().pimientaMail).update(`google:${sub}`).digest();

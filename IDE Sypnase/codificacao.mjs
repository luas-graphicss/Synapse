export const WAF_ANGULO = String.fromCharCode(10216);
export const WAF_RAZAO = String.fromCharCode(8758);
export const WAF_IGUAL = String.fromCharCode(65309);

const ENTIDADE_ANGULO = '&#10216;';
const ENTIDADE_RAZAO = '&#8758;';
const ENTIDADE_IGUAL = '&#65309;';

const RE_URI_CODIFICAR = /((?:java|vb|live)script)(\s*):/gi;
const RE_DATA_CODIFICAR = /(data)(\s*):(\s*text\s*\/\s*html)/gi;
const RE_HANDLER_CODIFICAR = /\bon([A-Za-z]{2,20})(\s*)=/g;
const RE_URI_DECODIFICAR = new RegExp(`((?:java|vb|live)script)(\\s*)${WAF_RAZAO}`, 'gi');
const RE_DATA_DECODIFICAR = new RegExp(`(data)(\\s*)${WAF_RAZAO}(\\s*text\\s*\\/\\s*html)`, 'gi');
const RE_HANDLER_DECODIFICAR = new RegExp(`\\bon([A-Za-z]{2,20})(\\s*)${WAF_IGUAL}`, 'g');
const RE_JSON_PERIGOSO = /[<>&\u2028\u2029]/g;

function reiniciar(...expressoes) {
	for (const expressao of expressoes) expressao.lastIndex = 0;
}

export function precisaCodificarWaf(texto) {
	if (typeof texto !== 'string' || !texto) return false;
	if (texto.includes('<') || texto.includes(WAF_ANGULO)) return true;
	if (texto.includes(WAF_RAZAO) || texto.includes(WAF_IGUAL)) return true;
	reiniciar(RE_URI_CODIFICAR, RE_HANDLER_CODIFICAR);
	const precisa = RE_URI_CODIFICAR.test(texto) || RE_HANDLER_CODIFICAR.test(texto);
	reiniciar(RE_URI_CODIFICAR, RE_HANDLER_CODIFICAR);
	return precisa;
}

export function codificarWaf(texto) {
	if (typeof texto !== 'string' || !texto) return texto;
	let t = texto;
	if (t.includes(WAF_ANGULO)) t = t.split(WAF_ANGULO).join(ENTIDADE_ANGULO);
	if (t.includes(WAF_RAZAO)) t = t.split(WAF_RAZAO).join(ENTIDADE_RAZAO);
	if (t.includes(WAF_IGUAL)) t = t.split(WAF_IGUAL).join(ENTIDADE_IGUAL);
	if (t.includes('<')) t = t.split('<').join(WAF_ANGULO);
	if (t.includes(':'))
		t = t
			.replace(RE_URI_CODIFICAR, `$1$2${WAF_RAZAO}`)
			.replace(RE_DATA_CODIFICAR, `$1$2${WAF_RAZAO}$3`);
	if (t.includes('=')) t = t.replace(RE_HANDLER_CODIFICAR, `on$1$2${WAF_IGUAL}`);
	return t;
}

export function decodificarWaf(texto) {
	if (typeof texto !== 'string' || !texto) return texto;
	let t = texto;
	if (t.includes(WAF_IGUAL)) t = t.replace(RE_HANDLER_DECODIFICAR, 'on$1$2=');
	if (t.includes(WAF_RAZAO))
		t = t.replace(RE_URI_DECODIFICAR, '$1$2:').replace(RE_DATA_DECODIFICAR, '$1$2:$3');
	if (t.includes(WAF_ANGULO)) t = t.split(WAF_ANGULO).join('<');
	if (t.includes(ENTIDADE_ANGULO)) t = t.split(ENTIDADE_ANGULO).join(WAF_ANGULO);
	if (t.includes(ENTIDADE_RAZAO)) t = t.split(ENTIDADE_RAZAO).join(WAF_RAZAO);
	if (t.includes(ENTIDADE_IGUAL)) t = t.split(ENTIDADE_IGUAL).join(WAF_IGUAL);
	return t;
}

export function mapearTextos(valor, transformar) {
	if (typeof valor === 'string') return transformar(valor);
	if (!valor || typeof valor !== 'object') return valor;
	if (Array.isArray(valor)) return valor.map((item) => mapearTextos(item, transformar));
	const saida = {};
	for (const chave of Object.keys(valor)) saida[chave] = mapearTextos(valor[chave], transformar);
	return saida;
}

export function codificarObjetoWaf(valor) {
	if (valor == null || typeof valor !== 'object') return valor;
	let serial = '';
	try {
		serial = JSON.stringify(valor);
	} catch {
		return valor;
	}
	return precisaCodificarWaf(serial) ? mapearTextos(valor, codificarWaf) : valor;
}

export function decodificarObjetoWaf(valor) {
	return mapearTextos(valor, decodificarWaf);
}

export function jsonSeguro(valor) {
	const texto = JSON.stringify(valor);
	if (texto === undefined) return 'null';
	return texto.replace(
		RE_JSON_PERIGOSO,
		(c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
	);
}

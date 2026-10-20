(function (root) {
	'use strict';

	const ALGORITHM = Object.freeze({ name: 'ECDSA', namedCurve: 'P-256' });
	const SIGN_PARAMS = Object.freeze({ name: 'ECDSA', hash: 'SHA-256' });
	const KEY_PREFIX = 'ext-signing:key:';
	const PUBLISHER_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

	function tr(text) {
		return typeof root.tr === 'function' ? root.tr(text) : text;
	}

	function subtle() {
		if (!root.crypto || !root.crypto.subtle) throw new Error('Web Crypto indisponível: abra a IDE em https ou localhost.');
		return root.crypto.subtle;
	}

	function kvGet(key) {
		return typeof root.sdbGet === 'function' ? root.sdbGet(key) : Promise.resolve(null);
	}

	function kvPut(key, value) {
		return typeof root.sdbPut === 'function' ? root.sdbPut(key, value) : Promise.resolve(false);
	}

	function kvDel(key) {
		return typeof root.sdbDel === 'function' ? root.sdbDel(key) : Promise.resolve(false);
	}

	function toBase64(bytes) {
		let binary = '';
		const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
		for (let index = 0; index < view.length; index += 0x8000) binary += String.fromCharCode.apply(null, view.subarray(index, index + 0x8000));
		return btoa(binary);
	}

	function fromBase64(text) {
		const normalized = String(text || '').replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
		const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
		const binary = atob(padded);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
		return bytes;
	}

	function toHex(buffer) {
		return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	function isPublicJwk(jwk) {
		return !!(jwk && typeof jwk === 'object' && jwk.kty === 'EC' && jwk.crv === 'P-256' && typeof jwk.x === 'string' && typeof jwk.y === 'string');
	}

	function publicJwkOf(jwk) {
		if (!isPublicJwk(jwk)) throw new Error('Chave pública inválida: esperado JWK EC P-256 com x e y.');
		return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
	}

	async function keyId(jwk) {
		const clean = publicJwkOf(jwk);
		const digest = await subtle().digest('SHA-256', new TextEncoder().encode(`${clean.x}.${clean.y}`));
		return toHex(digest).slice(0, 16);
	}

	function importPublicKey(jwk) {
		return subtle().importKey('jwk', { ...publicJwkOf(jwk), ext: true }, ALGORITHM, true, ['verify']);
	}

	function importPrivateKey(jwk) {
		if (!isPublicJwk(jwk) || typeof jwk.d !== 'string') throw new Error('Chave privada inválida.');
		return subtle().importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true }, ALGORITHM, true, ['sign']);
	}

	async function verify(bytes, signatureBase64, publicJwk) {
		let signature;
		try {
			signature = fromBase64(signatureBase64);
		} catch (error) {
			return false;
		}
		if (signature.length !== 64) return false;
		try {
			const key = await importPublicKey(publicJwk);
			return await subtle().verify(SIGN_PARAMS, key, signature, bytes);
		} catch (error) {
			return false;
		}
	}

	async function sign(bytes, privateJwk) {
		const key = await importPrivateKey(privateJwk);
		const signature = await subtle().sign(SIGN_PARAMS, key, bytes);
		return toBase64(signature);
	}

	async function generateKeyPair() {
		const pair = await subtle().generateKey(ALGORITHM, true, ['sign', 'verify']);
		const privateJwk = await subtle().exportKey('jwk', pair.privateKey);
		const publicJwk = publicJwkOf(privateJwk);
		return { privateJwk: { kty: 'EC', crv: 'P-256', x: privateJwk.x, y: privateJwk.y, d: privateJwk.d }, publicJwk, keyId: await keyId(publicJwk) };
	}

	function normalizePublisher(value) {
		const publisher = String(value || '').trim().toLowerCase();
		if (!PUBLISHER_PATTERN.test(publisher)) throw new Error('Publisher inválido: use minúsculas, números e hífens (login do GitHub).');
		return publisher;
	}

	async function loadPrivateKey(publisher) {
		const stored = await kvGet(KEY_PREFIX + normalizePublisher(publisher)).catch(() => null);
		return stored && isPublicJwk(stored.privateJwk) && typeof stored.privateJwk.d === 'string' ? stored : null;
	}

	async function savePrivateKey(publisher, record) {
		return kvPut(KEY_PREFIX + normalizePublisher(publisher), record);
	}

	function publisherJson(publisher, publicJwk, id) {
		return {
			publisher: normalizePublisher(publisher),
			keyId: id,
			algorithm: 'ECDSA-P256-SHA256',
			signatureFormat: 'ieee-p1363-base64',
			publicKey: publicJwkOf(publicJwk),
			createdAt: new Date().toISOString(),
		};
	}

	function parsePublisherJson(json) {
		if (!json || typeof json !== 'object') return null;
		const publicKey = json.publicKey || json.publicJwk;
		if (!isPublicJwk(publicKey)) return null;
		return { publisher: String(json.publisher || ''), keyId: typeof json.keyId === 'string' ? json.keyId : '', publicKey: publicJwkOf(publicKey), algorithm: String(json.algorithm || 'ECDSA-P256-SHA256'), createdAt: json.createdAt || null, revokedKeyIds: Array.isArray(json.revokedKeyIds) ? json.revokedKeyIds.map(String) : [] };
	}

	async function signPackage(publisher, bytes) {
		const record = await loadPrivateKey(publisher);
		if (!record) return null;
		return { signature: await sign(bytes, record.privateJwk), keyId: record.keyId, publisher: normalizePublisher(publisher) };
	}

	function download(text, name) {
		const blob = new Blob([text], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = name;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 2000);
	}

	function toast(title, message, kind) {
		if (typeof root.toast === 'function') root.toast(title, message, kind || 'ok');
	}

	function output() {
		return root.SynapseExtensionOutput;
	}

	async function askPublisher(title) {
		if (typeof root.uiPrompt !== 'function') return null;
		const value = await root.uiPrompt(title, tr('Login do GitHub do publisher, em minúsculas.'), { placeholder: 'meu-login', okLabel: tr('Continuar') });
		if (value === null || value === undefined || !String(value).trim()) return null;
		return normalizePublisher(value);
	}

	async function generateKeyCommand() {
		let publisher;
		try {
			publisher = await askPublisher(tr('Gerar chave de assinatura'));
		} catch (error) {
			toast(tr('Publisher inválido'), error.message, 'err');
			return null;
		}
		if (!publisher) return null;
		const existing = await loadPrivateKey(publisher);
		if (existing && typeof root.uiConfirm === 'function') {
			const replace = await root.uiConfirm(tr('Chave já existe'), `${tr('Já existe uma chave para')} "${publisher}" (keyId ${existing.keyId}). ${tr('Gerar uma nova substitui a atual; pacotes antigos continuam válidos apenas se a chave antiga permanecer publicada.')}`, tr('Substituir'), true);
			if (!replace) return null;
		}
		try {
			const pair = await generateKeyPair();
			await savePrivateKey(publisher, { publisher, keyId: pair.keyId, privateJwk: pair.privateJwk, createdAt: Date.now() });
			const json = JSON.stringify(publisherJson(publisher, pair.publicJwk, pair.keyId), null, 2) + '\n';
			download(json, 'publisher.json');
			if (output()) {
				output().command('assinatura', `Chave ECDSA P-256 gerada para "${publisher}" (keyId ${pair.keyId}). A chave privada fica só neste navegador.`);
				output().info('assinatura', `Publique o arquivo baixado em registry/${publisher}/publisher.json no repositório do registro (via PR). A partir daí, "Extensões: Publicar…" assina os pacotes automaticamente.`);
				output().show();
			}
			toast(tr('Chave gerada'), `${publisher} · keyId ${pair.keyId} · publisher.json baixado`, 'ok');
			return pair.keyId;
		} catch (error) {
			toast(tr('Falha ao gerar chave'), error.message, 'err');
			return null;
		}
	}

	async function exportKeyCommand() {
		let publisher;
		try {
			publisher = await askPublisher(tr('Exportar chave privada'));
		} catch (error) {
			toast(tr('Publisher inválido'), error.message, 'err');
			return null;
		}
		if (!publisher) return null;
		const record = await loadPrivateKey(publisher);
		if (!record) {
			toast(tr('Sem chave'), `${tr('Nenhuma chave de assinatura para')} "${publisher}".`, 'warn');
			return null;
		}
		const ok = typeof root.uiConfirm === 'function' ? await root.uiConfirm(tr('Exportar chave privada'), tr('O arquivo contém a chave privada. Guarde-o fora do repositório e nunca o publique.'), tr('Exportar'), true) : true;
		if (!ok) return null;
		download(JSON.stringify({ publisher, keyId: record.keyId, privateJwk: record.privateJwk, createdAt: record.createdAt }, null, 2) + '\n', `${publisher}.signing-key.private.json`);
		return true;
	}

	async function importKeyCommand() {
		const picked = await new Promise((resolve) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'application/json,.json';
			input.style.display = 'none';
			input.addEventListener('change', async () => {
				const file = input.files && input.files[0];
				input.remove();
				resolve(file ? await file.text() : null);
			});
			input.addEventListener('cancel', () => {
				input.remove();
				resolve(null);
			});
			document.body.appendChild(input);
			input.click();
		});
		if (!picked) return null;
		try {
			const json = JSON.parse(picked);
			const publisher = normalizePublisher(json.publisher);
			if (!isPublicJwk(json.privateJwk) || typeof json.privateJwk.d !== 'string') throw new Error('Arquivo sem privateJwk válido.');
			const id = await keyId(json.privateJwk);
			await savePrivateKey(publisher, { publisher, keyId: id, privateJwk: { kty: 'EC', crv: 'P-256', x: json.privateJwk.x, y: json.privateJwk.y, d: json.privateJwk.d }, createdAt: Date.now() });
			toast(tr('Chave importada'), `${publisher} · keyId ${id}`, 'ok');
			return id;
		} catch (error) {
			toast(tr('Falha ao importar chave'), error.message, 'err');
			return null;
		}
	}

	async function removeKeyCommand() {
		let publisher;
		try {
			publisher = await askPublisher(tr('Remover chave de assinatura'));
		} catch (error) {
			toast(tr('Publisher inválido'), error.message, 'err');
			return null;
		}
		if (!publisher) return null;
		const ok = typeof root.uiConfirm === 'function' ? await root.uiConfirm(tr('Remover chave de assinatura'), `${publisher}: ${tr('a chave privada será apagada deste navegador. Sem backup, não será possível assinar novas versões com ela.')}`, tr('Remover'), true) : true;
		if (!ok) return null;
		await kvDel(KEY_PREFIX + publisher);
		toast(tr('Chave removida'), publisher, 'ok');
		return true;
	}

	function registerCommands() {
		const registry = root.SynapseExtensions;
		if (!registry || typeof registry.registerPaletteCommand !== 'function') return;
		[
			() => ({ id: 'synapse.extensions.signing.generate', label: tr('Extensões: Gerar chave de assinatura do publisher'), hint: tr('ECDSA P-256 · publisher.json para o registro'), icon: 'lock', run: generateKeyCommand }),
			() => ({ id: 'synapse.extensions.signing.export', label: tr('Extensões: Exportar chave privada de assinatura'), icon: 'lock', run: exportKeyCommand }),
			() => ({ id: 'synapse.extensions.signing.import', label: tr('Extensões: Importar chave privada de assinatura'), icon: 'lock', run: importKeyCommand }),
			() => ({ id: 'synapse.extensions.signing.remove', label: tr('Extensões: Remover chave de assinatura'), icon: 'lock', run: removeKeyCommand }),
		].forEach((factory) => registry.registerPaletteCommand(factory));
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerCommands, { once: true });
	else setTimeout(registerCommands, 0);

	root.SynapseExtensionSigning = Object.freeze({
		ALGORITHM,
		isPublicJwk,
		publicJwkOf,
		keyId,
		importPublicKey,
		verify,
		sign,
		generateKeyPair,
		loadPrivateKey,
		savePrivateKey,
		signPackage,
		publisherJson,
		parsePublisherJson,
		toBase64,
		fromBase64,
	});
})(window);

(function (root) {
	'use strict';
	if (root.SynapseCofreGuarda) return;

	const EVENTO = 'synapse:tentativa-de-exclusao';
	const PREFIXO_DB = 'aurora-lp';
	const PREFIXO_LS = 'aurora.';

	const PRELUDIO =
		'try{(function(){var P=' +
		JSON.stringify(PREFIXO_DB) +
		',L=' +
		JSON.stringify(PREFIXO_LS) +
		';function avisar(o,n){try{console.warn("[Synapse] bloqueado: o preview tentou apagar "+o+" da IDE ("+n+")")}catch(e){}' +
		'try{window.parent&&window.parent!==window&&window.parent.postMessage({__lp_guarda:"tentativa-de-exclusao",alvo:o,nome:String(n)},"*")}catch(e){}}' +
		'var idb=window.indexedDB;if(idb){var del=idb.deleteDatabase.bind(idb);' +
		'idb.deleteDatabase=function(n){if(String(n).indexOf(P)===0){avisar("o banco",n);' +
		'var r={readyState:"pending",result:undefined,error:null,onerror:null,onsuccess:null,onblocked:null,onupgradeneeded:null,' +
		'addEventListener:function(t,f){if(t==="error")this.__e=(this.__e||[]).concat(f)},removeEventListener:function(){}};' +
		'setTimeout(function(){r.readyState="done";try{r.error=new DOMException("Banco protegido pela IDE","SecurityError")}catch(e){r.error=new Error("Banco protegido pela IDE")}' +
		'var ev={type:"error",target:r,preventDefault:function(){}};try{if(typeof r.onerror==="function")r.onerror(ev)}catch(e){}' +
		'try{(r.__e||[]).forEach(function(f){f(ev)})}catch(e){}},0);return r}return del(n)};' +
		'if(typeof idb.databases==="function"){var dbs=idb.databases.bind(idb);idb.databases=function(){return dbs().then(function(l){return (l||[]).filter(function(d){return !(d&&String(d.name).indexOf(P)===0)})})}}}' +
		'try{var ls=window.localStorage;if(ls&&window.Storage){var clr=Storage.prototype.clear;Storage.prototype.clear=function(){if(this!==ls)return clr.call(this);' +
		'var keep={};for(var i=0;i<this.length;i++){var k=this.key(i);if(k&&k.indexOf(L)===0)keep[k]=this.getItem(k)}clr.call(this);var n=0;for(var kk in keep){n++;try{this.setItem(kk,keep[kk])}catch(e){}}if(n)avisar("as preferencias",n+" chave(s) preservada(s)")};' +
		'var rem=Storage.prototype.removeItem;Storage.prototype.removeItem=function(k){if(this===ls&&k&&String(k).indexOf(L)===0){avisar("uma preferencia",k);return}return rem.call(this,k)}}}catch(e){}' +
		'})()}catch(e){}';

	function disparar(detalhe) {
		try {
			root.dispatchEvent(new CustomEvent(EVENTO, { detail: detalhe || {} }));
		} catch (e) {

		}
	}

	function protegerConexao(db, onDrop) {
		if (!db) return;
		db.onversionchange = function (ev) {
			const apagando = !ev || ev.newVersion === null || ev.newVersion === undefined;
			if (apagando) {
				registrarTentativa('versionchange');
				return;
			}
			try {
				db.close();
			} catch (e) {

			}
			if (typeof onDrop === 'function') onDrop();
		};
	}

	let ultima = 0;
	function registrarTentativa(origem) {
		const agora = Date.now();
		const detalhe = { t: agora, origem: origem || 'desconhecida' };
		try {
			const M = root.SynapseCofreManifesto;
			if (M && root.localStorage) M.writeWipe(root.localStorage, detalhe);
		} catch (e) {

		}
		try {
			if (root.registro)
				root.registro.erro(
					'[Synapse/cofre] tentativa de apagar o banco da sessao (' + detalhe.origem + ')',
				);
		} catch (e) {

		}

		if (agora - ultima < 1500) return detalhe;
		ultima = agora;
		disparar(detalhe);
		return detalhe;
	}

	function escutarPreview() {
		try {
			root.addEventListener('message', function (ev) {
				const d = ev && ev.data;
				if (!d || d.__lp_guarda !== 'tentativa-de-exclusao') return;
				registrarTentativa('preview:' + (d.alvo || '?') + (d.nome ? ' ' + d.nome : ''));
			});
		} catch (e) {

		}
	}
	escutarPreview();

	root.SynapseCofreGuarda = Object.freeze({
		EVENTO: EVENTO,
		PRELUDIO: PRELUDIO,
		protegerConexao: protegerConexao,
		registrarTentativa: registrarTentativa,
	});
})(typeof window !== 'undefined' ? window : globalThis);

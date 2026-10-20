(function (root) {
	'use strict';

	const TOKENS = Object.freeze([
		['bg', '--bg'],
		['bg-1', '--bg-1'],
		['bg-2', '--bg-2'],
		['bg-3', '--bg-3'],
		['line', '--line'],
		['line-2', '--line-2'],
		['txt', '--txt'],
		['txt-2', '--txt-2'],
		['txt-3', '--txt-3'],
		['acc', '--acc'],
		['acc-2', '--acc-2'],
		['acc-ink', '--acc-ink'],
		['acc-rgb', '--acc-rgb'],
		['ok', '--ok'],
		['warn', '--warn'],
		['err', '--err'],
		['info', '--info'],
		['radius', '--r'],
		['radius-sm', '--r-sm'],
		['font-ui', '--ui'],
		['font-mono', '--mono'],
	]);

	const KIT_CSS = [
		':root{--synapse-bg:#141210;--synapse-bg-1:#191613;--synapse-bg-2:#1f1c18;--synapse-bg-3:#2a2620;--synapse-line:#332e26;--synapse-line-2:#4a4335;--synapse-txt:#ece5d8;--synapse-txt-2:#b5ab99;--synapse-txt-3:#847a69;--synapse-acc:#ef7137;--synapse-acc-2:#c95722;--synapse-acc-ink:#211106;--synapse-acc-rgb:239,113,55;--synapse-ok:#79b877;--synapse-warn:#d9ae54;--synapse-err:#e35d55;--synapse-info:#8fb0c9;--synapse-radius:6px;--synapse-radius-sm:4px;--synapse-font-ui:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--synapse-font-mono:ui-monospace,"SF Mono","JetBrains Mono",Consolas,monospace}',
		'*,*::before,*::after{box-sizing:border-box}',
		'html,body{margin:0;padding:0;min-height:100%}',
		'body{background:var(--synapse-bg-1);color:var(--synapse-txt);font:12.5px/1.5 var(--synapse-font-ui);-webkit-font-smoothing:antialiased}',
		'body.sx-pad{padding:12px}',
		'code,pre,kbd,.sx-mono{font-family:var(--synapse-font-mono);font-size:12px}',
		'a{color:var(--synapse-acc);text-decoration:none}a:hover{text-decoration:underline}',
		'::selection{background:rgba(var(--synapse-acc-rgb),.35)}',
		'::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:var(--synapse-bg-3);border-radius:8px;border:2px solid var(--synapse-bg-1)}::-webkit-scrollbar-thumb:hover{background:var(--synapse-line-2)}::-webkit-scrollbar-track{background:transparent}',
		':focus-visible{outline:1px solid var(--synapse-acc);outline-offset:1px}',
		'.sx-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:26px;padding:0 10px;border:1px solid var(--synapse-line-2);border-radius:var(--synapse-radius-sm);background:var(--synapse-bg-3);color:var(--synapse-txt);font:inherit;font-size:12px;line-height:1;cursor:pointer;white-space:nowrap;user-select:none}',
		'.sx-btn:hover{background:var(--synapse-line);border-color:var(--synapse-line-2)}',
		'.sx-btn:active{transform:translateY(1px)}',
		'.sx-btn:disabled{opacity:.5;cursor:default;transform:none}',
		'.sx-btn.primary{background:var(--synapse-acc);border-color:var(--synapse-acc);color:var(--synapse-acc-ink);font-weight:600}',
		'.sx-btn.primary:hover{background:var(--synapse-acc-2);border-color:var(--synapse-acc-2)}',
		'.sx-btn.ghost{background:transparent;border-color:transparent;color:var(--synapse-txt-2)}',
		'.sx-btn.ghost:hover{background:var(--synapse-bg-3);color:var(--synapse-txt)}',
		'.sx-btn.sm{height:22px;padding:0 7px;font-size:11.5px}',
		'.sx-input,.sx-select,.sx-textarea{width:100%;height:26px;padding:0 8px;border:1px solid var(--synapse-line-2);border-radius:var(--synapse-radius-sm);background:var(--synapse-bg);color:var(--synapse-txt);font:inherit;font-size:12.5px}',
		'.sx-textarea{height:auto;min-height:64px;padding:6px 8px;resize:vertical;font-family:var(--synapse-font-mono);font-size:12px;line-height:1.5}',
		'.sx-input::placeholder,.sx-textarea::placeholder{color:var(--synapse-txt-3)}',
		'.sx-input:focus,.sx-select:focus,.sx-textarea:focus{border-color:var(--synapse-acc);outline:none}',
		'.sx-input.invalid{border-color:var(--synapse-err)}',
		'.sx-field{display:flex;flex-direction:column;gap:4px}',
		'.sx-label{color:var(--synapse-txt-2);font-size:11.5px}',
		'.sx-hint{color:var(--synapse-txt-3);font-size:11px}',
		'.sx-row{display:flex;align-items:center;gap:8px}',
		'.sx-stack{display:flex;flex-direction:column;gap:8px}',
		'.sx-grow{flex:1;min-width:0}',
		'.sx-check{display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--synapse-txt)}',
		'.sx-check input{width:14px;height:14px;margin:0;accent-color:var(--synapse-acc)}',
		'.sx-list{list-style:none;margin:0;padding:0;border:1px solid var(--synapse-line);border-radius:var(--synapse-radius-sm);background:var(--synapse-bg);overflow:hidden}',
		'.sx-list-item{display:flex;align-items:center;gap:8px;min-height:28px;padding:0 10px;color:var(--synapse-txt);cursor:default}',
		'.sx-list-item+.sx-list-item{border-top:1px solid var(--synapse-line)}',
		'.sx-list-item:hover{background:var(--synapse-bg-2)}',
		'.sx-list-item.selected{background:rgba(var(--synapse-acc-rgb),.16);color:var(--synapse-txt)}',
		'.sx-list-item .sx-meta{margin-left:auto;color:var(--synapse-txt-3);font-size:11px;font-family:var(--synapse-font-mono)}',
		'.sx-table{width:100%;border-collapse:collapse;font-size:12px}',
		'.sx-table th,.sx-table td{padding:5px 8px;text-align:left;border-bottom:1px solid var(--synapse-line);vertical-align:middle}',
		'.sx-table th{color:var(--synapse-txt-2);font-weight:600;font-size:11px;letter-spacing:.02em;text-transform:uppercase;background:var(--synapse-bg-2);position:sticky;top:0}',
		'.sx-table tbody tr:hover{background:var(--synapse-bg-2)}',
		'.sx-tabs{display:flex;gap:2px;border-bottom:1px solid var(--synapse-line)}',
		'.sx-tab{height:28px;padding:0 10px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--synapse-txt-2);font:inherit;font-size:12px;cursor:pointer}',
		'.sx-tab:hover{color:var(--synapse-txt)}',
		'.sx-tab[aria-selected="true"]{color:var(--synapse-txt);border-bottom-color:var(--synapse-acc)}',
		'.sx-panel{padding:10px;border:1px solid var(--synapse-line);border-radius:var(--synapse-radius);background:var(--synapse-bg-2)}',
		'.sx-divider{height:1px;margin:8px 0;background:var(--synapse-line)}',
		'.sx-badge{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:9px;background:var(--synapse-bg-3);color:var(--synapse-txt-2);font-size:10.5px;font-weight:600}',
		'.sx-badge.acc{background:rgba(var(--synapse-acc-rgb),.2);color:var(--synapse-acc)}',
		'.sx-badge.ok{color:var(--synapse-ok)}.sx-badge.warn{color:var(--synapse-warn)}.sx-badge.err{color:var(--synapse-err)}',
		'.sx-empty{padding:24px 12px;text-align:center;color:var(--synapse-txt-3);font-size:12px}',
		'.sx-swatch{width:20px;height:20px;border-radius:4px;border:1px solid rgba(0,0,0,.25);flex:none}',
		'.sx-kbd{display:inline-block;min-width:16px;padding:1px 5px;border:1px solid var(--synapse-line-2);border-bottom-width:2px;border-radius:3px;background:var(--synapse-bg-3);color:var(--synapse-txt-2);font-family:var(--synapse-font-ui);font-size:10.5px;line-height:1.3}',
		'h1,h2,h3{margin:0 0 6px;font-weight:600;letter-spacing:-.01em}h1{font-size:15px}h2{font-size:13px}h3{font-size:12px;color:var(--synapse-txt-2)}',
		'p{margin:0 0 8px}',
	].join('\n');

	function luminance(color) {
		const probe = document.createElement('span');
		probe.style.color = color;
		document.body.appendChild(probe);
		const computed = getComputedStyle(probe).color;
		probe.remove();
		const match = computed.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
		if (!match) return 0;
		const [r, g, b] = [match[1], match[2], match[3]].map((value) => Number(value) / 255);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}

	function themeSnapshot() {
		const styles = getComputedStyle(document.documentElement);
		const vars = {};
		TOKENS.forEach(([name, token]) => {
			const value = styles.getPropertyValue(token).trim();
			if (value) vars['--synapse-' + name] = value;
		});
		const background = vars['--synapse-bg'] || '#141210';
		const kind = luminance(background) > 0.5 ? 'light' : 'dark';
		return { vars, kind, id: document.documentElement.getAttribute('data-theme') || 'dark' };
	}

	function bootstrapScript(state) {
		return (
			'(function(){' +
			'var state=' + JSON.stringify(state === undefined ? null : state) + ';var api=null;' +
			'function post(type,data){try{parent.postMessage({__synapse:1,type:type,data:data},"*");}catch(e){}}' +
			'function applyTheme(t){if(!t||!t.vars)return;var r=document.documentElement;Object.keys(t.vars).forEach(function(k){r.style.setProperty(k,t.vars[k]);});r.setAttribute("data-synapse-theme",t.kind||"dark");r.style.colorScheme=t.kind||"dark";}' +
			'window.addEventListener("message",function(e){var m=e.data;if(!m||m.__synapse!==1)return;e.stopImmediatePropagation();' +
			'if(m.type==="theme"){applyTheme(m.data);return;}' +
			'if(m.type==="message"){window.dispatchEvent(new MessageEvent("message",{data:m.data}));}},true);' +
			'window.acquireSynapseApi=function(){if(api)return api;api=Object.freeze({postMessage:function(d){post("message",d);},setState:function(s){state=s;post("state",s);return s;},getState:function(){return state;}});return api;};' +
			'window.acquireVsCodeApi=window.acquireSynapseApi;' +
			'document.addEventListener("click",function(e){var t=e.target;var a=t&&t.closest?t.closest("a[href]"):null;if(!a)return;var h=a.getAttribute("href")||"";if(/^(https?:|mailto:)/i.test(h)){e.preventDefault();post("openExternal",h);}},true);' +
			'document.addEventListener("DOMContentLoaded",function(){post("ready",null);});' +
			'})();'
		);
	}

	function csp(hostNonce, userNonce, enableScripts) {
		const scripts = enableScripts ? `'nonce-${hostNonce}' 'nonce-${userNonce}'` : `'nonce-${hostNonce}'`;
		return [
			"default-src 'none'",
			`script-src ${scripts}`,
			"style-src 'unsafe-inline' data:",
			'img-src data: blob:',
			'font-src data:',
			'media-src data: blob:',
			"connect-src 'none'",
			"form-action 'none'",
			"base-uri 'none'",
			"frame-src 'none'",
			"object-src 'none'",
		].join('; ');
	}

	function escapeAttribute(text) {
		return String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
	}

	function buildDocument(input) {
		const html = String(input.html || '');
		const theme = input.theme || themeSnapshot();
		const head =
			`<meta http-equiv="Content-Security-Policy" content="${csp(input.hostNonce, input.userNonce, input.enableScripts !== false)}">` +
			`<meta charset="utf-8">` +
			`<style nonce="${input.hostNonce}" data-synapse-kit>${KIT_CSS}</style>` +
			`<script nonce="${input.hostNonce}">${bootstrapScript(input.state)}</script>` +
			`<script nonce="${input.hostNonce}">(function(){var t=${JSON.stringify(theme)};var r=document.documentElement;Object.keys(t.vars).forEach(function(k){r.style.setProperty(k,t.vars[k]);});r.setAttribute("data-synapse-theme",t.kind);r.style.colorScheme=t.kind;})();</script>`;
		const headMatch = /<head(\s[^>]*)?>/i.exec(html);
		if (headMatch) return html.slice(0, headMatch.index + headMatch[0].length) + head + html.slice(headMatch.index + headMatch[0].length);
		const htmlMatch = /<html(\s[^>]*)?>/i.exec(html);
		if (htmlMatch) {
			const cut = htmlMatch.index + htmlMatch[0].length;
			return html.slice(0, cut) + '<head>' + head + '</head>' + html.slice(cut);
		}
		return `<!DOCTYPE html><html lang="${escapeAttribute(document.documentElement.lang || 'pt-BR')}"><head>${head}<title>${escapeAttribute(input.title || '')}</title></head><body class="sx-pad">${html}</body></html>`;
	}

	function nonce() {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	root.SynapseExtensionWebviewKit = Object.freeze({ TOKENS, KIT_CSS, themeSnapshot, buildDocument, nonce, csp });
})(window);

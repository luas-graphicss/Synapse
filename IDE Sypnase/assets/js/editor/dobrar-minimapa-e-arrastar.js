'use strict';

let __drag = null;

function highlight(code, lang) {
  return window.SynapseSyntax.highlight(code, lang);
}

function revokeBlobs(proj) {
  window.SynapsePreviewProjectBlobs.releaseAll(proj);
}
function limparBlobsSoltos(proj) {
  const manter = new Set(window.SynapsePreviewBlobUsage.usedUrls(proj));
  if (proj.blobCache)
  for (const e of proj.blobCache.values()) {
    if (e && e.url) manter.add(e.url);
  }
  if (proj.cssBlobCache)
  for (const e of proj.cssBlobCache.values()) {
    if (e && e.url) manter.add(e.url);
  }
  for (const u of [...proj.blobs]) {
    if (!manter.has(u)) {
      try {
        window.SynapsePreviewResources.retire(proj, u);
      } catch (e) {
        ignorarErro(e, 'limparBlobsSoltos');
      }
    }
  }
}
function mkBlob(proj, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  proj.blobs.add(url);
  window.SynapsePreviewBlobUsage.trackBuildUrl(proj, url);
  return url;
}
function fileBytes(f) {
  if (f.data) return f.data;
  if (f.text != null) return new TextEncoder().encode(f.text);
  return new Uint8Array();
}
function fileText(f) {
  if (f.text != null) return f.text;
  if (f.data) return bytesToText(f.data);
  return '';
}

const __crcT = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = __crcT[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
async function deflateRawAsync(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const stream = new Response(new Blob([bytes])).body.pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (e) {
    return null;
  }
}
async function buildZip(items) {
  const te = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosDate =
  (((now.getFullYear() - 1980) & 0x7f) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | ((now.getSeconds() / 2) | 0);
  for (const it of items) {
    const isDir = it.data == null;
    const nameB = te.encode(isDir && !it.name.endsWith('/') ? it.name + '/' : it.name);
    const data = isDir ? new Uint8Array(0) : it.data;
    const crc = isDir ? 0 : crc32(data);
    let method = 0,
    comp = data;
    if (!isDir && data.length > 63) {
      const d = await deflateRawAsync(data);
      if (d && d.length < data.length) {
        method = 8;
        comp = d;
      }
    }
    const lh = new Uint8Array(30 + nameB.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, method, true);
    dv.setUint16(10, dosTime, true);
    dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, comp.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, nameB.length, true);
    lh.set(nameB, 30);
    chunks.push(lh, comp);
    central.push({ nameB, method, crc, cs: comp.length, us: data.length, off: offset, isDir });
    offset += lh.length + comp.length;
  }
  let cdSize = 0;
  const cdStart = offset;
  for (const e of central) {
    const ch = new Uint8Array(46 + e.nameB.length);
    const dv = new DataView(ch.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, e.method, true);
    dv.setUint16(12, dosTime, true);
    dv.setUint16(14, dosDate, true);
    dv.setUint32(16, e.crc, true);
    dv.setUint32(20, e.cs, true);
    dv.setUint32(24, e.us, true);
    dv.setUint16(28, e.nameB.length, true);
    dv.setUint32(38, e.isDir ? 0x10 : 0, true);
    dv.setUint32(42, e.off, true);
    ch.set(e.nameB, 46);
    chunks.push(ch);
    cdSize += ch.length;
  }
  const eocd = new Uint8Array(22);
  const dv = new DataView(eocd.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(8, central.length, true);
  dv.setUint16(10, central.length, true);
  dv.setUint32(12, cdSize, true);
  dv.setUint32(16, cdStart, true);
  chunks.push(eocd);
  return new Blob(chunks, { type: 'application/zip' });
}
function projectZipItems(proj) {
  const paths = [...proj.files.keys()].sort();
  const items = paths.map((p) => ({ name: p, data: fileBytes(proj.files.get(p)) }));
  if (proj.emptyDirs)
  for (const d of [...proj.emptyDirs].sort()) {
    if (!paths.some((p) => p.startsWith(d + '/'))) items.push({ name: d + '/', data: null });
  }
  return items;
}
function safeZipName(n) {
  n = String(n || 'projeto')
  .replace(/\.zip$/i, '')
  .replace(/[\\/:*?"<>|]+/g, '-')
      .trim();
      return (n || 'projeto') + '.zip';
    }
    let __expUrlT = null;
    async function copyDownloadLink(txt) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(txt);
          return true;
        }
      } catch (e) {
        ignorarErro(e, 'copyDownloadLink');
      }
      try {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, txt.length);
        let ok = false;
        try {
          ok = document.execCommand('copy');
        } catch (e) {
          ignorarErro(e, 'copyDownloadLink');
        }
        ta.remove();
        return !!ok;
      } catch (e) {
        return false;
      }
    }
    function showExportResult(fname, url, size, started) {
      const back = document.createElement('div');
      back.className = 'ui-back';
      back.innerHTML =
      '<div class="ui-modal" role="dialog" aria-modal="true"><div class="ui-h">' +
      (started ? 'Download iniciado' : 'Exportação pronta') +
      '</div>' +
      '<div class="ui-msg">' +
      (started
        ? `O navegador deve estar baixando <b>${esc(fname)}</b> (${esc(mvSize(size))}). Se o download não apareceu (bloqueado ou recusado), use o link abaixo.`
        : `O navegador recusou iniciar o download automático. Use o link abaixo para baixar <b>${esc(fname)}</b> (${esc(mvSize(size))}).`) +
      '</div>' +
      '<a class="exp-link" href="' +
      url +
      '" download="' +
      esc(fname) +
      '"><span class="i-export"></span> Baixar ' +
      esc(fname) +
      '</a>' +
      '<div class="exp-note">O link fica válido enquanto esta aba estiver aberta (por até 10 minutos) e só funciona neste navegador. Se salvar com nome genérico, renomeie para ' +
      esc(fname) +
      '.</div>' +
      '<div class="ui-actions"><button class="ui-btn" data-act="copylink">Copiar link</button><button class="ui-btn primary" data-act="ok">Fechar</button></div></div>';
      document.body.appendChild(back);
      hydrateIcons(back);
      const close = () => back.remove();
      back.addEventListener('mousedown', (e) => {
          if (e.target === back) close();
      });
      back.querySelector('[data-act="ok"]').addEventListener('click', close);
      const cb = back.querySelector('[data-act="copylink"]');
      cb.addEventListener('click', async () => {
          const ok = await copyDownloadLink(url);
          cb.textContent = ok ? 'Link copiado!' : 'Não consegui copiar';
          setTimeout(() => {
              cb.textContent = 'Copiar link';
            }, 2000);
          if (ok)
          toast(
            'Link copiado',
            `Link de download de ${fname} na área de transferência — vale por 10 min nesta aba`,
            'ok',
          );
      });
      setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            ignorarErro(e, 'showExportResult');
          }
        }, 600000);
    }
    async function exportProjectZip(id) {
      const proj = State.projects.find((p) => p.id === id) || activeProject();
      if (!proj) {
        toast('Nada para exportar', 'Importe ou crie um projeto primeiro', 'warn');
        return;
      }
      setStatus('run', 'Gerando .zip…');
      try {
        const items = projectZipItems(proj);
        if (!items.length) {
          setStatus('err', 'Projeto vazio');
          toast('Projeto vazio', 'Não há arquivos para exportar', 'warn');
          return;
        }
        const blob = await buildZip(items);
        const fname = safeZipName(proj.name);
        const url = URL.createObjectURL(blob);
        let started = false;
        try {
          const a = document.createElement('a');
          a.href = url;
          a.download = fname;
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
          started = true;
        } catch (e) {
          started = false;
        }
        setStatus('ok', '.zip exportado');
        logCmd(
          proj,
          `Exportado "${fname}" — ${items.length} item(ns), ${mvSize(blob.size)} (todas as edições incluídas).`,
        );
        showExportResult(fname, url, blob.size, started);
      } catch (err) {
        setStatus('err', 'Falha ao exportar');
        toast('Erro ao exportar', (err && err.message) || String(err), 'err');
      }
    }
    function exportZipDialog() {
      if (!State.projects.length) {
        toast('Nada para exportar', 'Importe ou crie um projeto primeiro', 'warn');
        return;
      }
      const back = document.createElement('div');
      back.className = 'ui-back';
      const rows = State.projects
      .map(
        (p) =>
        `<label class="exp-row"><input type="radio" name="expProj" value="${esc(p.id)}"${p.id === State.active ? ' checked' : ''}/>\
<span class="exp-name">${esc(p.name)}</span><span class="exp-meta">${p.files.size} arquivo(s)</span>\
</label>`,
      )
      .join('');
      back.innerHTML = `<div class="ui-modal" role="dialog" aria-modal="true"><div class="ui-h">Exportar \
projeto (.zip)</div><div class="ui-msg">Escolha qual projeto baixar. O .zip é gerado com o estado atual \
dos arquivos — todas as edições feitas aqui vão junto.</div><div class="exp-list">${rows}</div><div \
class="ui-actions"><button class="ui-btn" data-act="cancel">Cancelar</button><button class="ui-btn primary" \
data-act="ok">Exportar .zip</button></div></div>`;
      document.body.appendChild(back);
      const close = () => back.remove();
      back.addEventListener('mousedown', (e) => {
          if (e.target === back) close();
      });
      back.querySelector('[data-act="cancel"]').addEventListener('click', close);
      back.querySelector('[data-act="ok"]').addEventListener('click', () => {
          const sel = back.querySelector('input[name="expProj"]:checked');
          const id = sel ? sel.value : State.active;
          close();
          exportProjectZip(id);
      });
    }

    function flutterPreviewDoc(proj) {
      const pub = proj.files.get('pubspec.yaml');
      const y = pub ? fileText(pub) : '';
      const g = (k) => {
        const m = y.match(new RegExp(`^${k}:[ \\t]*(.+)$`, 'm'));
        return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
          };
          const appName = g('name') || proj.name || 'app_flutter';
          const desc = g('description') || 'Projeto Flutter';
          const ver = g('version');
          const dm = y.match(/^dependencies:[ \t]*\r?\n((?:[ \t]+[^\r\n]*\r?\n?)*)/m);
          const deps = dm
          ? [...dm[1].matchAll(/^[ \t]{2}([A-Za-z0-9_]+):/gm)]
          .map((x) => x[1])
          .filter((d) => d !== 'flutter')
          : [];
          const dart = [...proj.files.keys()].filter((p) => p.endsWith('.dart')).sort();
          const lib = dart.filter((p) => p.startsWith('lib/'));
          const shown = (lib.length ? lib : dart).slice(0, 12);
          const chips =
          deps
          .slice(0, 16)
          .map((d) => `<span class="chip">${esc(d)}</span>`)
          .join('') || '<span class="chip dim">sem dependências extras</span>';
          const filesHtml = shown.map((p) => `<li>${esc(p)}</li>`).join('');
          return (
            '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
            esc(appName) +
            '</title><style>' +
            ('body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
              'background:linear-gradient(160deg,#0b1220,#12203a);color:#e8eefb;min-height:100vh;' +
              'display:flex;align-items:center;justify-content:center;padding:28px;box-sizing:' +
              'border-box}') +
            '.card{max-width:640px;width:100%;background:rgba(13,22,40,.88);border:1px solid rgba(120,170,255,.22);border-radius:16px;padding:28px 30px;box-shadow:0 18px 60px rgba(0,0,0,.45)}' +
            '.top{display:flex;align-items:center;gap:14px;margin-bottom:6px}' +
            '.logo{width:46px;height:46px;border-radius:12px;background:#0f2038;display:flex;align-items:center;justify-content:center;border:1px solid rgba(84,197,248,.35)}' +
            'h1{font-size:21px;margin:0}' +
            '.ver{font-size:12px;color:#8fb7ff;font-family:ui-monospace,Menlo,Consolas,monospace}' +
            ('.ok{display:inline-flex;align-items:center;gap:7px;background:rgba(46,204,113,.13);' +
              'border:1px solid rgba(46,204,113,.4);color:#7ee2a8;font-size:12.5px;font-weight:600;' +
              'border-radius:999px;padding:5px 12px;margin:10px 0 2px}') +
            'p.desc{color:#aebfdd;font-size:13.5px;line-height:1.55;margin:10px 0 0}' +
            'h2{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#7f95bd;margin:22px 0 8px}' +
            '.chips{display:flex;flex-wrap:wrap;gap:6px}' +
            '.chip{background:rgba(84,197,248,.12);border:1px solid rgba(84,197,248,.3);color:#9fd8ff;border-radius:999px;padding:4px 11px;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace}' +
            '.chip.dim{opacity:.6}' +
            'ul{margin:0;padding:0 0 0 2px;list-style:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:#b9cae9;line-height:1.9}' +
            'ul li::before{content:"◆";color:#54c5f8;margin-right:8px;font-size:9px}' +
            '.steps{background:#0d1830;border:1px solid rgba(120,170,255,.18);border-radius:12px;padding:14px 16px;margin-top:8px}' +
            '.steps b{color:#dfe9ff}' +
            '.steps code{display:block;background:#091124;border-radius:8px;padding:8px 12px;margin:8px 0;color:#8fd6ff;font-size:12.5px;font-family:ui-monospace,Menlo,Consolas,monospace}' +
            '.steps span{color:#93a7cc;font-size:12.5px;line-height:1.6}' +
            '</style></head><body><div class="card">' +
            ('<div class="top"><div class="logo"><svg width="26" height="26" viewBox="0 0 24 24" ' +
              'fill="none"><path d="M13.5 2 4 11.5l3 3L19.5 2z" fill="#54c5f8"/><path d="M13.5 11 8.7 ' +
              '15.8l3 3L13.5 17l6-6z" fill="#54c5f8"/><path d="M11.7 18.8l1.8 1.8h6l-4.8-4.8z" ' +
              'fill="#0468d7"/></svg></div>') +
            '<div><h1>' +
            esc(appName) +
            '</h1>' +
            (ver ? `<div class="ver">v${esc(ver)}</div>` : '') +
            '</div></div>' +
            '<div class="ok">✓ Projeto Flutter reconhecido — sem erros</div>' +
            '<p class="desc">' +
            esc(desc) +
            '</p>' +
            '<h2>Dependências (pubspec.yaml)</h2><div class="chips">' +
            chips +
            '</div>' +
            '<h2>Código Dart (' +
            dart.length +
            ' arquivo' +
            (dart.length === 1 ? '' : 's') +
            ')</h2><ul>' +
            filesHtml +
            (dart.length > shown.length ? `<li>… e mais ${dart.length - shown.length}</li>` : '') +
            '</ul>' +
            ('<h2>Ver o app rodando aqui</h2><div class="steps"><span>Dart compila fora do navegador. ' +
              'Gere o build web e reimporte o projeto (com a pasta <b>build/web</b>) — o preview passa ' +
              'a mostrar o app real automaticamente:</span>') +
            '<code>flutter pub get</code><code>flutter build web</code>' +
            '<span>Depois é só importar o .zip aqui de novo.</span></div>' +
            '</div></body></html>'
          );
        }

        const scheduleHandles = new Map();

const ICONS = {
  selectAll: '<rect x="3" y="3" width="7" height="7" rx="1"/><path d="m4.5 6.5 1.5 1.5 2.5-3M14 6h7M14 12h7M14 18h7"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.5 7.5 12 13M8.5 16.5 12 3"/>',
  paste: '<path d="M9 5H5v16h14V5h-4"/><rect x="9" y="3" width="6" height="4" rx="1"/>',
  undo: '<path d="m4 10 4-4M4 10l4 4M4 10h10a6 6 0 0 1 0 12"/>',
  console: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 13h4M7 16h8"/><circle cx="6" cy="6.5" r=".5"/>',
  quickOpen: '<path d="M13 3H5v18h7M13 3v5h5V8l-5-5"/><circle cx="16" cy="15" r="4"/><path d="m19 18 3 3"/>',
  format: '<path d="m7 5-4 7 4 7m10-14 4 7-4 7M10 8h4m-4 4h3m-3 4h4"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7M12 7v5l3 2"/>',
  addFiles: '<path d="M14 3H5v18h14V9M14 3v6h5M12 18v-7m-3 3 3-3 3 3"/>',
  assets: '<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12M3 17l4-4 3 3 3-4 4 5"/><circle cx="7" cy="10" r="1"/>',
  completion: '<path d="M4 4h5M6.5 4v16M4 20h5M12 7h8M12 11h5m-5 6 2 2 6-6"/>',
  workspaceTools: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 16h7m-7 4h7M17 14v4m2 0v4"/>',
  fileTools: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10H3z"/><circle cx="8" cy="13" r=".6"/><circle cx="12" cy="13" r=".6"/><circle cx="16" cy="13" r=".6"/>',
  previewTools: '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="7" cy="10" r=".6"/><circle cx="12" cy="10" r=".6"/><circle cx="17" cy="10" r=".6"/>',
  editorTools: '<path d="m6 5-4 7 4 7m12-14 4 7-4 7"/><circle cx="9" cy="12" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="15" cy="12" r=".6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  newfile:
  '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  newdir:
  '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6M9 14h6"/>',
  proj: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/>',
  import: '<path d="M12 16V4M8 8l4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  zip: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M10 7h2M10 10h2M10 13h2M9 16h4v3H9z"/>',
  export:
  '<path d="M12 3v10"/><path d="M8 9l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  folderOpen:
  '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2"/><path d="M3 9h18l-2 9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  html: '<path d="M5 4l1.5 16L12 22l5.5-2L19 4z"/><path d="M8 8h8l-.5 4-3.5 1-3.5-1"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  aiCompletion:
  '<path d="M4 6h7M4 11h5M4 16h9"/>' +
  '<path d="M17.5 5l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"/>',
  palette:
  '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.7 0 3-1.3 3-3 ' +
  '0-.8-.3-1.5-.8-2-.5-.5-.8-1.2-.8-2 0-1.7 1.3-3 3-3h1.8c1.5 0 2.8-1.3 2.8-2.8C23 5.6 18 ' +
  '2 12 2z"/><circle cx="6.5" cy="11.5" r="1.3"/><circle cx="9.5" cy="7.5" r="1.3"/>' +
  '<circle cx="14.5" cy="7.5" r="1.3"/><circle cx="17.5" cy="11.5" r="1.3"/>',
  resp: '<rect x="3" y="5" width="12" height="9" rx="1"/><rect x="16" y="8" width="5" height="11" rx="1"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>',
  tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
  mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  rotate:
  '<rect x="2.5" y="9" width="11.5" height="11.5" rx="2.5"/>' +
  '<path d="M8.5 4.5h4.5a6 6 0 0 1 6 6v4.5"/>' +
  '<path d="M10.5 2.5 8.5 4.5l2 2"/><path d="M17 13l2 2 2-2"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  reload: '<path d="M20 12a8 8 0 1 1-2.35-5.65L20 9"/><path d="M20 4.5v4.5h-4.5"/>',
  term: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  external:
  '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  collapse:
  '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10M11 14h6"/>',
  drop: '<path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  err: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  warn: '<path d="M12 3l9 16H3z"/><path d="M12 9v5M12 17v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/>',
  css: '<path d="M5 4l1.5 16L12 22l5.5-2L19 4z"/><path d="M8 8h8M9 12h6l-.4 4-2.6 1-2.6-1"/>',
  js: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9v5a1.5 1.5 0 0 1-3 0M13 14a1.6 1.6 0 0 0 3 0c0-2-3-1.4-3-3.2a1.5 1.5 0 0 1 2.8-.6"/>',
  json: '<path d="M8 4c-2 0-2 3-2 4s0 2-2 2 2 1 2 2 0 4 2 4M16 4c2 0 2 3 2 4s0 2 2 2-2 1-2 2 0 4-2 4"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 16l-5-5L5 20"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z"/>',
  command: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/>',
  enter: '<path d="M9 10l-4 4 4 4"/><path d="M5 14h11a4 4 0 0 0 4-4V6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2.6"/>',
};
const hydratedIconSlots = new WeakMap();

function iconSvg(name, className) {
  const iconName = Object.hasOwn(ICONS, name) ? name : 'file';
  return `<svg class="icon ${className || ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-icon-name="${iconName}">${ICONS[iconName]}</svg>`;
}

function hydrateIcons(root) {
  const aliases = { 'quick-open': 'quickOpen', 'add-files': 'addFiles' };
  (root || document).querySelectorAll('[class*="i-"]').forEach((element) => {
      const iconClass = [...element.classList].find((className) => className.startsWith('i-'));
      if (!iconClass) return;
      const name = iconClass.slice(2);
      const iconName = aliases[name] || name;
      if (!Object.hasOwn(ICONS, iconName)) return;
      const markup = iconSvg(iconName);
      const previous = hydratedIconSlots.get(element);
      if (
        previous?.markup === markup &&
        previous.node === element.firstElementChild &&
        element.childElementCount === 1
      )
      return;
      element.innerHTML = markup;
      element.dataset.ico = '1';
      hydratedIconSlots.set(element, { markup, node: element.firstElementChild });
  });
}

const Core = (function () {
    function normalizePath(p) {
      p = String(p).replace(/\\/g, '/');
      const abs = p.startsWith('/');
      const parts = p.split('/');
      const out = [];
      for (const part of parts) {
        if (part === '' || part === '.') continue;
        if (part === '..') {
          if (out.length && out[out.length - 1] !== '..') out.pop();
          else if (!abs) out.push('..');
        } else out.push(part);
      }
      return (abs ? '/' : '') + out.join('/');
    }
    function dirname(p) {
      p = normalizePath(p);
      const i = p.lastIndexOf('/');
      return i <= 0 ? '' : p.slice(0, i);
    }
    function basename(p) {
      p = normalizePath(p);
      const i = p.lastIndexOf('/');
      return i < 0 ? p : p.slice(i + 1);
    }
    function extname(p) {
      const b = basename(p);
      const i = b.lastIndexOf('.');
      return i <= 0 ? '' : b.slice(i).toLowerCase();
    }
    function joinPath(base, rel) {
      rel = String(rel).replace(/\\/g, '/');
      if (
        /^([a-z]+:)?\/\//i.test(rel) ||
        rel.startsWith('data:') ||
        rel.startsWith('blob:') ||
        rel.startsWith('#') ||
        rel.startsWith('//')
      )
      return rel;
      if (rel.startsWith('/')) return normalizePath(rel);
      return normalizePath((base ? base + '/' : '') + rel);
    }
    const MIME = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.cjs': 'text/javascript',
      '.jsx': 'text/javascript',
      '.ts': 'text/javascript',
      '.tsx': 'text/javascript',
      '.json': 'application/json',
      '.map': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.eot': 'application/vnd.ms-fontobject',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.xml': 'application/xml',
      '.wasm': 'application/wasm',
      '.csv': 'text/csv',
    };
    function getMime(name) {
      return MIME[extname(name)] || 'application/octet-stream';
    }
    const TEXT_EXT = new Set([
        '.html',
        '.htm',
        '.css',
        '.js',
        '.mjs',
        '.cjs',
        '.jsx',
        '.ts',
        '.tsx',
        '.json',
        '.svg',
        '.txt',
        '.md',
        '.xml',
        '.csv',
        '.map',
        '.yml',
        '.yaml',
        '.toml',
        '.env',
        '.gitignore',
        '.babelrc',
        '.eslintrc',
        '.editorconfig',
        '.lock',
        '.scss',
        '.sass',
        '.less',
        '.vue',
        '.astro',
        '.dart',
        '.arb',
        '.gradle',
        '.kts',
        '.kt',
        '.properties',
        '.podspec',
        '.plist',
        '.xcconfig',
        '.cmake',
        '.iml',
        '.java',
        '.py',
        '.rb',
        '.php',
        '.c',
        '.h',
        '.cpp',
        '.hpp',
        '.cc',
        '.hh',
        '.cs',
        '.rs',
        '.go',
        '.swift',
        '.m',
        '.mm',
        '.sh',
        '.bash',
        '.zsh',
        '.fish',
        '.bat',
        '.cmd',
        '.ps1',
        '.sql',
        '.ini',
        '.cfg',
        '.conf',
        '.log',
        '.pro',
        '.r',
        '.lua',
        '.pl',
        '.pm',
        '.ex',
        '.exs',
        '.erl',
        '.hrl',
        '.hs',
        '.jl',
        '.zig',
        '.nim',
        '.gd',
        '.tscn',
        '.tres',
        '.mtl',
        '.graphql',
        '.gql',
        '.proto',
        '.tf',
        '.tfvars',
        '.htaccess',
        '.markdown',
        '.rst',
        '.adoc',
        '.tex',
        '.srt',
        '.vtt',
        '.ndjson',
        '.jsonc',
        '.json5',
        '.webmanifest',
        '.gitattributes',
        '.gitmodules',
        '.dockerignore',
        '.npmrc',
        '.nvmrc',
        '.prettierrc',
        '.stylelintrc',
    ]);
    function isTextFile(name) {
      const e = extname(name);
      if (e === '')
      return [
        'license',
        'readme',
        'dockerfile',
        'procfile',
        'makefile',
        '.gitignore',
        '.npmrc',
        '.metadata',
        '.flutter-plugins',
        '.flutter-plugins-dependencies',
        '.packages',
        'podfile',
        'fastfile',
        'appfile',
        'gemfile',
        'rakefile',
        'brewfile',
        'justfile',
        'gradlew',
        'codeowners',
        'authors',
        'changelog',
        'notice',
        'version',
        'cname',
      ].includes(basename(name).toLowerCase());
      return TEXT_EXT.has(e);
    }
    function isBinaryFile(name) {
      return !isTextFile(name);
    }
    function langOf(name) {
      const e = extname(name);
      if (
        [
          '.js',
          '.mjs',
          '.cjs',
          '.jsx',
          '.ts',
          '.tsx',
          '.dart',
          '.kt',
          '.kts',
          '.swift',
          '.gradle',
        ].includes(e)
      )
      return 'js';
      if (e === '.css' || e === '.scss' || e === '.less') return 'css';
      if (e === '.html' || e === '.htm' || e === '.xml' || e === '.svg' || e === '.vue')
      return 'html';
      if (e === '.json') return 'json';
      return 'text';
    }

    function detectProject(paths, pkg) {
      const set = new Set(paths.map(normalizePath));
      const has = (p) => set.has(normalizePath(p));
      const anyExt = (exts) => paths.some((p) => exts.includes(extname(p)));
      const res = {
        type: 'static',
        buildNeeded: false,
        entry: null,
        framework: null,
        commands: [],
        runnable: true,
        note: '',
      };
      const htmls = paths.filter((p) => extname(p) === '.html').map(normalizePath);
      htmls.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
      const rootIndex = htmls.find((h) => h === 'index.html');
      res.entry = rootIndex || htmls[0] || null;
      const cmakeProject = globalThis.SYNAPSE_CMAKE_PROJECT?.primary(paths);
      if (cmakeProject) {
        res.type = 'cmake';
        res.framework = 'cmake';
        res.buildNeeded = true;
        res.runnable = !!res.entry;
        res.note = 'CMake — configure, compile e teste pelo botão CMake';
        return res;
      }
      const isFlutter = has('pubspec.yaml') && (has('lib/main.dart') || anyExt(['.dart']));
      if (isFlutter) {
        res.framework = 'flutter';
        res.type = 'flutter';
        res.buildNeeded = false;
        res.runnable = true;
        const webBuild =
        htmls.find((h) => h === 'build/web/index.html') ||
        htmls.find((h) => /(^|\/)build\/web\/index\.html$/.test(h)) ||
        null;
        res.entry = webBuild;
        res.commands = ['flutter pub get', 'flutter build web'];
        res.note = webBuild
        ? 'Flutter (build web detectado)'
        : 'Flutter — visão geral do app no preview';
        return res;
      }
      if (pkg && typeof pkg === 'object') {
        const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
        const scripts = pkg.scripts || {};
        const dep = (n) => Object.prototype.hasOwnProperty.call(deps, n);
        if (dep('vite')) res.framework = 'vite';
        else if (dep('next')) res.framework = 'next';
        else if (dep('react-scripts')) res.framework = 'cra';
        else if (dep('@angular/core')) res.framework = 'angular';
        else if (dep('vue')) res.framework = 'vue';
        else if (dep('svelte')) res.framework = 'svelte';
        else if (dep('react')) res.framework = 'react';
        const hasBuild = !!scripts.build;
        const hasDev = !!(scripts.dev || scripts.start || scripts.serve);
        const needsTool =
        ['vite', 'next', 'cra', 'angular', 'vue', 'svelte'].includes(res.framework) ||
        hasBuild ||
        hasDev;
        if (needsTool) {
          res.type = 'build';
          res.buildNeeded = true;
          if (scripts.install !== undefined || true) res.commands.push('npm install');
          if (hasDev)
          res.commands.push('npm run ' + (scripts.dev ? 'dev' : scripts.start ? 'start' : 'serve'));
          else if (hasBuild) res.commands.push('npm run build');
        }
      }
      const hasJsxTs = anyExt(['.jsx', '.tsx', '.ts']) || res.framework === 'react';
      if (res.type === 'build') {
        res.runnable = false;
      } else if (hasJsxTs && !res.entry) {
        res.type = 'runtime';
        res.runnable = true;
        res.note = 'Transformação JSX/TS no navegador';
      }
      if (!res.entry && res.type === 'static') {
        res.runnable = paths.length > 0;
      }
      return res;
    }

    function computeFitScale(containerW, containerH, deviceW, deviceH, pad) {
      pad = pad || 0;
      const aw = Math.max(0, containerW - pad * 2),
      ah = Math.max(0, containerH - pad * 2);
      if (deviceW <= 0 || deviceH <= 0) return 1;
      const s = Math.min(aw / deviceW, ah / deviceH, 1);
      return Math.max(0.1, Math.round(s * 1000) / 1000);
    }

    function readU16(b, o) {
      return b[o] | (b[o + 1] << 8);
    }
    function readU32(b, o) {
      return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    }
    function parseZipCentral(bytes) {
      let eocd = -1;
      for (let i = bytes.length - 22; i >= 0; i--) {
        if (readU32(bytes, i) === 0x06054b50) {
          eocd = i;
          break;
        }
      }
      if (eocd < 0) throw new Error('ZIP inválido: EOCD não encontrado');
      const count = readU16(bytes, eocd + 10);
      let off = readU32(bytes, eocd + 16);
      const entries = [];
      for (let n = 0; n < count; n++) {
        if (readU32(bytes, off) !== 0x02014b50) break;
        const method = readU16(bytes, off + 10);
        const compSize = readU32(bytes, off + 20);
        const size = readU32(bytes, off + 24);
        const nameLen = readU16(bytes, off + 28);
        const extraLen = readU16(bytes, off + 30);
        const commentLen = readU16(bytes, off + 32);
        const localOff = readU32(bytes, off + 42);
        const name = utf8Decode(bytes.subarray(off + 46, off + 46 + nameLen));
        entries.push({ name, method, compSize, size, localOff });
        off += 46 + nameLen + extraLen + commentLen;
      }
      return SynapseZipGuard.safeEntries(entries);
    }
    function localDataStart(bytes, localOff) {
      if (readU32(bytes, localOff) !== 0x04034b50) throw new Error('ZIP: local header inválido');
      const nameLen = readU16(bytes, localOff + 26);
      const extraLen = readU16(bytes, localOff + 28);
      return localOff + 30 + nameLen + extraLen;
    }
    function utf8Decode(bytes) {
      if (typeof TextDecoder !== 'undefined') {
        try {
          return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (e) {
          ignorarErro(e, 'utf8Decode');
        }
        try {
          return new TextDecoder('windows-1252').decode(bytes);
        } catch (e) {
          ignorarErro(e, 'utf8Decode');
        }
        return new TextDecoder('utf-8').decode(bytes);
      }
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      try {
        return decodeURIComponent(escape(s));
      } catch (e) {
        return s;
      }
    }
    function parseZipSync(bytes, inflateRaw) {
      const entries = parseZipCentral(bytes);
      const budget = SynapseZipGuard.createExpansionBudget();
      const out = [];
      for (const e of entries) {
        if (e.name.endsWith('/')) continue;
        SynapseZipGuard.checkDeclaredSize(e);
        const start = localDataStart(bytes, e.localOff);
        const comp = bytes.subarray(start, start + e.compSize);
        let data;
        if (e.method === 0) data = comp.slice();
        else if (e.method === 8) data = inflateRaw(comp);
        else throw new Error(`ZIP: método ${e.method} não suportado (${e.name})`);
        budget.add(e.name, data.length);
        out.push({ name: e.name, data });
      }
      return out;
    }
    function stripCommonRoot(paths) {
      const dirs = paths.map((p) => p.split('/'));
      if (paths.length < 2) {
        const seg = paths[0] ? paths[0].split('/') : [];
        return seg.length > 1 ? seg[0] : null;
      }
      const first = dirs[0][0];
      if (!first) return null;
      const allShare = dirs.every((d) => d.length > 1 && d[0] === first);
      return allShare ? first : null;
    }
    return {
      normalizePath,
      dirname,
      basename,
      extname,
      joinPath,
      getMime,
      isTextFile,
      isBinaryFile,
      langOf,
      detectProject,
      computeFitScale,
      parseZipCentral,
      localDataStart,
      parseZipSync,
      stripCommonRoot,
      utf8Decode,
    };
})();
window.Core = Core;
if (typeof module !== 'undefined' && module.exports) module.exports = Core;

async function inflateRawAsync(bytes) {
  if (typeof DecompressionStream === 'undefined')
  throw new Error(
    'Seu navegador não suporta DecompressionStream para descompactar .zip. Use Chrome/Edge/Firefox recentes.',
  );
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Response(new Blob([bytes])).body.pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
async function parseZipAsync(bytes) {
  const entries = Core.parseZipCentral(bytes);
  const budget = SynapseZipGuard.createExpansionBudget();
  const out = [];
  for (const e of entries) {
    if (e.name.endsWith('/')) continue;
    SynapseZipGuard.checkDeclaredSize(e);
    const start = Core.localDataStart(bytes, e.localOff);
    const comp = bytes.subarray(start, start + e.compSize);
    let data;
    if (e.method === 0) data = comp.slice();
    else if (e.method === 8) data = await inflateRawAsync(comp);
    else throw new Error('Método de compressão não suportado: ' + e.method);
    budget.add(e.name, data.length);
    out.push({ name: e.name, data });
  }
  return out;
}

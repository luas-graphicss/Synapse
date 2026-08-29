'use strict';
const U3D = {
	m: { f: 1, label: 'm' },
	cm: { f: 0.01, label: 'cm' },
	mm: { f: 0.001, label: 'mm' },
	stud: { f: 0.28, label: 'studs' },
	ft: { f: 0.3048, label: 'ft' },
	in: { f: 0.0254, label: 'pol' },
};
function u3dGet(u) {
	let k0 = String(u || 'm')
		.toLowerCase()
		.trim();
	try {
		k0 = k0.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	} catch (e) {
		ignorarErro(e, 'u3dGet');
	}
	const k = k0.replace(/s$/, '');
	const map = {
		m: 'm',
		metro: 'm',
		cm: 'cm',
		centimetro: 'cm',
		mm: 'mm',
		milimetro: 'mm',
		stud: 'stud',
		ft: 'ft',
		pe: 'ft',
		foot: 'ft',
		feet: 'ft',
		in: 'in',
		inch: 'in',
		inche: 'in',
		pol: 'in',
		polegada: 'in',
	};
	const kk = map[k];
	if (!kk) throw new Error(`Unidade invalida: ${u}. Use m, cm, mm, stud, ft ou in.`);
	return { key: kk, f: U3D[kk].f, label: U3D[kk].label };
}
function u3dVal(vm, u) {
	const x = vm / u.f;
	const a = Math.abs(x);
	const dec = a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : 4;
	let s = x.toFixed(dec);
	if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
	return s.replace('.', ',');
}
function u3dFmt(vm, u) {
	return u3dVal(vm, u) + ' ' + u.label;
}
function est3dStud(proj, a) {
	const sm = Number(a && a.stud_m);
	const meta = est3dMeta(proj);
	if (sm > 0) {
		U3D.stud.f = sm;
		if (meta.studM !== sm) {
			meta.studM = sm;
			est3dSaveMeta(proj, meta);
		}
		return;
	}
	U3D.stud.f = typeof meta.studM === 'number' && meta.studM > 0 ? meta.studM : 0.28;
}
function est3dStep(target) {
	if (!(target > 0)) return 1;
	const p = Math.pow(10, Math.floor(Math.log(target) / Math.LN10));
	const r = target / p;
	return (r >= 5 ? 5 : r >= 2 ? 2 : 1) * p;
}

const EST3D = { cache: new Map(), MAX: 2, META: 'aurora.3d.json', glctx: null };
function est3dSig(f) {
	const b = fileBytes(f);
	const L = b.length;
	let h = 0x811c9dc5;
	function mix(i) {
		h ^= b[i];
		h = Math.imul(h, 16777619) >>> 0;
	}
	if (L <= 16777216) {
		for (let i = 0; i < L; i++) mix(i);
	} else {
		const st = Math.ceil(L / 1048576);
		for (let i = 0; i < L; i += st) mix(i);
		for (let i = 0; i < 4096; i++) mix(i);
		for (let i = L - 4096; i < L; i++) mix(i);
	}
	return h + ':' + L;
}
function est3dMeta(proj) {
	const f = proj.files.get(EST3D.META);
	if (f && f.isText && f.text) {
		try {
			const j = JSON.parse(f.text);
			if (j && j.models) return j;
		} catch (e) {
			ignorarErro(e, 'est3dMeta');
		}
	}
	return { version: 1, models: {} };
}
function est3dSaveMeta(proj, meta) {
	const txt = JSON.stringify(meta, null, 1);
	let f = proj.files.get(EST3D.META);
	if (f && f.isText && f.text != null) {
		mcpHist(f);
		f.text = txt;
		f.data = null;
	} else {
		f = newFileEntry(EST3D.META);
		f.isText = true;
		f.text = txt;
		f.data = null;
		f.history = [{ t: Date.now(), text: txt }];
		proj.files.set(EST3D.META, f);
	}
	mcpAfterWrite(proj, EST3D.META);
}
function est3dNum3(v) {
	return Array.isArray(v) && v.length === 3
		? v.map(function (x) {
				const n = Number(x);
				return isFinite(n) ? n : 0;
			})
		: [0, 0, 0];
}
function est3dState(proj, path) {
	const meta = est3dMeta(proj);
	const m = meta.models[path] || {};
	return {
		pivot: est3dNum3(m.pivot),
		rotation: est3dNum3(m.rotation),
		scale: typeof m.scale === 'number' && isFinite(m.scale) && m.scale > 0 ? m.scale : 1,
		unit: m.unit || null,
		applied: !!m.applied,
	};
}
function est3dPutState(proj, path, st, agentName) {
	const meta = est3dMeta(proj);
	meta.models[path] = {
		pivot: st.pivot.map(function (v) {
			return +(+v).toFixed(6);
		}),
		rotation: st.rotation.map(Number),
		scale: +st.scale,
		unit: st.unit || null,
		applied: !!st.applied,
		updatedBy: agentName || null,
		updatedAt: Date.now(),
	};
	est3dSaveMeta(proj, meta);
}

function est3dLoad(proj, rawPath) {
	const p = mcpNorm(rawPath);
	const f = proj.files.get(p);
	if (!f)
		throw new Error(
			`Arquivo nao encontrado: ${p}. Use model3d_list para ver os modelos do projeto.`,
		);
	const ext = (Core.extname(p) || '').toLowerCase();
	if (ext === '.fbx')
		throw new Error(
			'FBX e um formato proprietario e nao pode ser lido offline. Use model3d_convert (requer relay + terminal) para gerar um .glb, ou converta no Blender (Arquivo > Exportar > glTF 2.0).',
		);
	if (!is3DExt(ext))
		throw new Error(`Nao e um modelo 3D suportado: ${p} (aceitos: .glb, .gltf, .obj, .stl).`);
	const bytes = fileBytes(f);
	if (bytes.length > 50 * 1048576)
		throw new Error(`Modelo grande demais (${mvSize(bytes.length)}). Limite do Estudio 3D: 50MB.`);
	const key = proj.id + ':' + p;
	const sig = est3dSig(f);
	const c = EST3D.cache.get(key);
	if (c && c.sig === sig) return c.val;
	let geo;
	try {
		geo = load3D(ext, f, proj, p);
	} catch (e) {
		let hint = '';
		if (ext === '.glb' || ext === '.gltf') {
			try {
				const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 262144)));
				if (head.includes('KHR_draco_mesh_compression'))
					hint =
						' Este arquivo usa compressao Draco, que o Estudio 3D nao le — reexporte sem Draco (no Blender: desmarque Compression ao exportar glTF).';
			} catch (e2) {
				ignorarErro(e2, 'est3dLoad');
			}
		}
		throw new Error(`Falha ao ler ${p}: ${(e && e.message) || e}${hint}`);
	}
	const val = {
		geo: geo,
		ext: ext,
		path: p,
		bytes: bytes.length,
		center: geo.center || [0, 0, 0],
		bboxMin: geo.bboxMin || [0, 0, 0],
		bboxMax: geo.bboxMax || [0, 0, 0],
		unitNote:
			ext === '.obj' || ext === '.stl'
				? `unidade do arquivo nao declarada (${ext.slice(1).toUpperCase()}); assumindo METROS`
				: null,
	};
	EST3D.cache.delete(key);
	EST3D.cache.set(key, { sig: sig, val: val });
	while (EST3D.cache.size > EST3D.MAX) {
		EST3D.cache.delete(EST3D.cache.keys().next().value);
	}
	return val;
}

function est3dEuler(rot) {
	const r = [(rot[0] * Math.PI) / 180, (rot[1] * Math.PI) / 180, (rot[2] * Math.PI) / 180];
	const cx = Math.cos(r[0]),
		sx = Math.sin(r[0]),
		cy = Math.cos(r[1]),
		sy = Math.sin(r[1]),
		cz = Math.cos(r[2]),
		sz = Math.sin(r[2]);
	return [
		cz * cy,
		cz * sy * sx - sz * cx,
		cz * sy * cx + sz * sx,
		sz * cy,
		sz * sy * sx + cz * cx,
		sz * sy * cx - cz * sx,
		-sy,
		cy * sx,
		cy * cx,
	];
}
function est3dQuat(rot) {
	const h = [(rot[0] * Math.PI) / 360, (rot[1] * Math.PI) / 360, (rot[2] * Math.PI) / 360];
	const cx = Math.cos(h[0]),
		sx = Math.sin(h[0]),
		cy = Math.cos(h[1]),
		sy = Math.sin(h[1]),
		cz = Math.cos(h[2]),
		sz = Math.sin(h[2]);
	return [
		sx * cy * cz - cx * sy * sz,
		cx * sy * cz + sx * cy * sz,
		cx * cy * sz - sx * sy * cz,
		cx * cy * cz + sx * sy * sz,
	];
}

function est3dEffective(proj, path, stateOverride) {
	const m = est3dLoad(proj, path);
	const st = stateOverride || est3dState(proj, m.path);
	const R = est3dEuler(st.rotation);
	const s = st.scale;
	const pv = st.pivot;
	const c = m.center;
	const pos = m.geo.pos;
	const triCount = m.geo.triCount;
	const maxTri = 250000;
	const stride = Math.max(1, Math.ceil(triCount / maxTri));
	const outTri = Math.floor((triCount + stride - 1) / stride);
	const P = new Float32Array(outTri * 9);
	const N = new Float32Array(outTri * 9);
	let mn0 = Infinity,
		mn1 = Infinity,
		mn2 = Infinity,
		mx0 = -Infinity,
		mx1 = -Infinity,
		mx2 = -Infinity;
	let o = 0;
	for (let t = 0; t < triCount; t++) {
		const base = t * 9;
		const keep = t % stride === 0 && o + 9 <= P.length;
		for (let v = 0; v < 3; v++) {
			const i = base + v * 3;
			const x = pos[i] + c[0] - pv[0],
				y = pos[i + 1] + c[1] - pv[1],
				z = pos[i + 2] + c[2] - pv[2];
			const tx = (R[0] * x + R[1] * y + R[2] * z) * s + pv[0];
			const ty = (R[3] * x + R[4] * y + R[5] * z) * s + pv[1];
			const tz = (R[6] * x + R[7] * y + R[8] * z) * s + pv[2];
			if (tx < mn0) mn0 = tx;
			if (ty < mn1) mn1 = ty;
			if (tz < mn2) mn2 = tz;
			if (tx > mx0) mx0 = tx;
			if (ty > mx1) mx1 = ty;
			if (tz > mx2) mx2 = tz;
			if (keep) {
				P[o + v * 3] = tx;
				P[o + v * 3 + 1] = ty;
				P[o + v * 3 + 2] = tz;
			}
		}
		if (keep) {
			const ax = P[o],
				ay = P[o + 1],
				az = P[o + 2],
				bx = P[o + 3],
				by = P[o + 4],
				bz = P[o + 5],
				ux = P[o + 6],
				uy = P[o + 7],
				uz = P[o + 8];
			let nx = (by - ay) * (uz - az) - (bz - az) * (uy - ay),
				ny = (bz - az) * (ux - ax) - (bx - ax) * (uz - az),
				nz = (bx - ax) * (uy - ay) - (by - ay) * (ux - ax);
			const l = Math.hypot(nx, ny, nz) || 1;
			nx /= l;
			ny /= l;
			nz /= l;
			for (let k = 0; k < 9; k += 3) {
				N[o + k] = nx;
				N[o + k + 1] = ny;
				N[o + k + 2] = nz;
			}
			o += 9;
		}
	}
	if (!isFinite(mn0)) {
		mn0 = mn1 = mn2 = 0;
		mx0 = mx1 = mx2 = 0;
	}
	const dims = [Math.max(mx0 - mn0, 1e-9), Math.max(mx1 - mn1, 1e-9), Math.max(mx2 - mn2, 1e-9)];
	return {
		pos: P.subarray(0, o),
		nrm: N.subarray(0, o),
		drawCount: (o / 3) | 0,
		bboxMin: [mn0, mn1, mn2],
		bboxMax: [mx0, mx1, mx2],
		dims: dims,
		center: [(mn0 + mx0) / 2, (mn1 + mx1) / 2, (mn2 + mx2) / 2],
		radius: Math.max(1e-5, Math.hypot(dims[0], dims[1], dims[2]) / 2),
		pivot: pv.slice(),
		state: st,
		triCount: triCount,
		drawnTri: (o / 9) | 0,
		vertCount: m.geo.vertCount,
		ext: m.ext,
		path: m.path,
		bytes: m.bytes,
		unitNote: m.unitNote,
		origMin: m.bboxMin.slice(),
		origMax: m.bboxMax.slice(),
	};
}

function est3dOrtho(W, H, n, f) {
	const o = new Float32Array(16);
	o[0] = 2 / W;
	o[5] = 2 / H;
	o[10] = -2 / (f - n);
	o[14] = -(f + n) / (f - n);
	o[15] = 1;
	return o;
}
function est3dGLCtx() {
	let g = EST3D.glctx;
	if (g && g.gl && !g.gl.isContextLost()) return g;
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 512;
	const gl = canvas.getContext('webgl', {
		antialias: true,
		alpha: false,
		preserveDrawingBuffer: true,
	});
	if (!gl)
		throw new Error(
			'WebGL indisponivel neste navegador — o Estudio 3D precisa de WebGL para renderizar.',
		);
	function sh(t, src) {
		const x = gl.createShader(t);
		gl.shaderSource(x, src);
		gl.compileShader(x);
		if (!gl.getShaderParameter(x, gl.COMPILE_STATUS))
			throw new Error(gl.getShaderInfoLog(x) || 'erro de shader');
		return x;
	}
	const vs =
		'attribute vec3 aPos;attribute vec3 aNormal;uniform mat4 uProj;uniform mat4 uView;' +
		'varying vec3 vN;varying vec3 vV;void main(){vec4 vp=uView*vec4(aPos,1.0);' +
		'gl_Position=uProj*vp;vN=aNormal;vV=normalize(-vp.xyz);}';
	const fs =
		'precision mediump float;varying vec3 vN;varying vec3 vV;uniform vec3 uColor;void main()' +
		'{vec3 N=normalize(vN);if(dot(N,vV)<0.0)N=-N;vec3 L=normalize(vec3(0.5,0.85,0.65));float ' +
		'd=max(dot(N,L),0.0);float hh=0.5+0.5*N.y;vec3 col=uColor*(0.35+0.65*d)*mix(0.75,1.05,hh)' +
		';float rim=pow(1.0-max(dot(N,vV),0.0),2.5)*0.18;col+=rim;gl_FragColor=vec4(col,1.0);}';
	const prog = gl.createProgram();
	gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
	gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
		throw new Error(gl.getProgramInfoLog(prog) || 'erro de link GL');
	gl.useProgram(prog);
	g = {
		canvas: canvas,
		gl: gl,
		prog: prog,
		aPos: gl.getAttribLocation(prog, 'aPos'),
		aNormal: gl.getAttribLocation(prog, 'aNormal'),
		uProj: gl.getUniformLocation(prog, 'uProj'),
		uView: gl.getUniformLocation(prog, 'uView'),
		uColor: gl.getUniformLocation(prog, 'uColor'),
		pbuf: gl.createBuffer(),
		nbuf: gl.createBuffer(),
	};
	gl.enable(gl.DEPTH_TEST);
	gl.disable(gl.CULL_FACE);
	gl.clearColor(0.082, 0.094, 0.125, 1);
	EST3D.glctx = g;
	return g;
}
function est3dUpload(g, eff) {
	const gl = g.gl;
	gl.bindBuffer(gl.ARRAY_BUFFER, g.pbuf);
	gl.bufferData(gl.ARRAY_BUFFER, eff.pos, gl.DYNAMIC_DRAW);
	gl.enableVertexAttribArray(g.aPos);
	gl.vertexAttribPointer(g.aPos, 3, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, g.nbuf);
	gl.bufferData(gl.ARRAY_BUFFER, eff.nrm, gl.DYNAMIC_DRAW);
	gl.enableVertexAttribArray(g.aNormal);
	gl.vertexAttribPointer(g.aNormal, 3, gl.FLOAT, false, 0, 0);
}
function est3dRenderGL(g, eff, view, w, h, color) {
	const gl = g.gl;
	if (g.canvas.width !== w || g.canvas.height !== h) {
		g.canvas.width = w;
		g.canvas.height = h;
	}
	gl.viewport(0, 0, w, h);
	const c = view.lookCenter || eff.center;
	const r = Math.max(eff.radius, 1e-5);
	let proj, viewM;
	if (view.persp) {
		proj = m4perspective((45 * Math.PI) / 180, Math.max(0.1, w / h), r * 0.01, r * 30);
		const e = view.dir;
		const d = r * 2.9;
		viewM = m4lookAt([c[0] + e[0] * d, c[1] + e[1] * d, c[2] + e[2] * d], c, view.upv);
	} else {
		proj = est3dOrtho(view.W, view.H, r * 0.01, r * 10);
		const d = view.dir;
		viewM = m4lookAt([c[0] + d[0] * r * 4, c[1] + d[1] * r * 4, c[2] + d[2] * r * 4], c, view.upv);
	}
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.uniformMatrix4fv(g.uProj, false, proj);
	gl.uniformMatrix4fv(g.uView, false, viewM);
	const col = color || [0.6, 0.71, 0.93];
	gl.uniform3f(g.uColor, col[0], col[1], col[2]);
	gl.drawArrays(gl.TRIANGLES, 0, eff.drawCount);
	return { proj: proj, view: viewM };
}
function est3dProj2(projM, viewM, p, w, h) {
	const v0 = viewM[0] * p[0] + viewM[4] * p[1] + viewM[8] * p[2] + viewM[12];
	const v1 = viewM[1] * p[0] + viewM[5] * p[1] + viewM[9] * p[2] + viewM[13];
	const v2 = viewM[2] * p[0] + viewM[6] * p[1] + viewM[10] * p[2] + viewM[14];
	const cw = projM[3] * v0 + projM[7] * v1 + projM[11] * v2 + projM[15];
	if (cw <= 0.0001) return null;
	const cx = (projM[0] * v0 + projM[4] * v1 + projM[8] * v2 + projM[12]) / cw;
	const cy = (projM[1] * v0 + projM[5] * v1 + projM[9] * v2 + projM[13]) / cw;
	return [(cx * 0.5 + 0.5) * w, (0.5 - cy * 0.5) * h];
}

const EST3D_VIEWS = [
	{ id: 'frente', label: 'FRENTE', dir: [0, 0, 1], upv: [0, 1, 0], ax: 'X', ay: 'Y' },
	{ id: 'tras', label: 'TRAS', dir: [0, 0, -1], upv: [0, 1, 0], ax: 'X (invertido)', ay: 'Y' },
	{ id: 'esquerda', label: 'ESQUERDA', dir: [-1, 0, 0], upv: [0, 1, 0], ax: 'Z', ay: 'Y' },
	{ id: 'direita', label: 'DIREITA', dir: [1, 0, 0], upv: [0, 1, 0], ax: 'Z (invertido)', ay: 'Y' },
	{ id: 'topo', label: 'TOPO', dir: [0, 1, 0], upv: [0, 0, -1], ax: 'X', ay: 'Z (invertido)' },
	{ id: 'baixo', label: 'BAIXO', dir: [0, -1, 0], upv: [0, 0, 1], ax: 'X', ay: 'Z' },
	{
		id: 'perspectiva',
		label: 'PERSPECTIVA 3/4',
		dir: [0.62, 0.45, 0.65],
		upv: [0, 1, 0],
		persp: true,
	},
];
function est3dPickViews(names) {
	if (!names || !names.length) return EST3D_VIEWS.slice();
	const alias = {
		front: 'frente',
		frente: 'frente',
		back: 'tras',
		tras: 'tras',
		costas: 'tras',
		left: 'esquerda',
		esquerda: 'esquerda',
		right: 'direita',
		direita: 'direita',
		top: 'topo',
		topo: 'topo',
		cima: 'topo',
		bottom: 'baixo',
		baixo: 'baixo',
		fundo: 'baixo',
		persp: 'perspectiva',
		perspectiva: 'perspectiva',
		'3/4': 'perspectiva',
	};
	const out = [];
	const seen = new Set();
	for (const n of names) {
		const id =
			alias[
				String(n || '')
					.toLowerCase()
					.trim()
			];
		if (!id)
			throw new Error(
				`Vista desconhecida: ${n}. Use: frente, tras, esquerda, direita, topo, baixo, perspectiva.`,
			);
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(
			EST3D_VIEWS.find(function (v) {
				return v.id === id;
			}),
		);
	}
	return out;
}
function est3dExtAlong(dims, v) {
	return Math.abs(v[0]) * dims[0] + Math.abs(v[1]) * dims[1] + Math.abs(v[2]) * dims[2];
}
function est3dRight(view) {
	const u = view.upv,
		d = view.dir;
	return [u[1] * d[2] - u[2] * d[1], u[2] * d[0] - u[0] * d[2], u[0] * d[1] - u[1] * d[0]];
}

function est3dDrawRulers(ctx, ix, iy, iw, ih, sc, u, extXm, extYm, axL, ayL) {
	const stepU = est3dStep(extXm / u.f / 5);
	const stepVU = est3dStep(extYm / u.f / 5);
	ctx.strokeStyle = 'rgba(160,175,200,0.9)';
	ctx.fillStyle = 'rgba(180,195,220,0.95)';
	ctx.lineWidth = 1;
	ctx.font = '9px ui-monospace,Menlo,monospace';
	const x0 = ix + (iw - extXm * sc) / 2,
		y1 = iy + ih - (ih - extYm * sc) / 2;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	for (let wU = 0; wU <= extXm / u.f + 1e-9; wU += stepU) {
		const px = x0 + wU * u.f * sc;
		if (px < ix - 1 || px > ix + iw + 1) break;
		ctx.beginPath();
		ctx.moveTo(px, iy + ih);
		ctx.lineTo(px, iy + ih + 5);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(px, iy);
		ctx.lineTo(px, iy - 5);
		ctx.stroke();
		ctx.fillText(String(+wU.toFixed(4)).replace('.', ','), px, iy + ih + 6);
	}
	ctx.textBaseline = 'middle';
	for (let hU = 0; hU <= extYm / u.f + 1e-9; hU += stepVU) {
		const py = y1 - hU * u.f * sc;
		if (py < iy - 1) break;
		ctx.beginPath();
		ctx.moveTo(ix, py);
		ctx.lineTo(ix - 5, py);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(ix + iw, py);
		ctx.lineTo(ix + iw + 5, py);
		ctx.stroke();
		ctx.textAlign = 'right';
		ctx.fillText(String(+hU.toFixed(4)).replace('.', ','), ix - 7, py);
		ctx.textAlign = 'left';
		ctx.fillText(String(+hU.toFixed(4)).replace('.', ','), ix + iw + 7, py);
	}
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = 'rgba(140,160,190,0.85)';
	ctx.font = '9px system-ui,sans-serif';
	ctx.fillText(axL + ' (' + u.label + ')', ix + iw / 2, iy + ih + 22);
	ctx.save();
	ctx.translate(ix - 24, iy + ih / 2);
	ctx.rotate(-Math.PI / 2);
	ctx.fillText(ayL + ' (' + u.label + ')', 0, 0);
	ctx.restore();
}
function est3dDrawPivot(ctx, pt, label) {
	if (!pt) return;
	ctx.save();
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.arc(pt[0], pt[1], 6, 0, Math.PI * 2);
	ctx.stroke();
	ctx.fillStyle = '#ff3b6b';
	ctx.beginPath();
	ctx.arc(pt[0], pt[1], 2.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255,255,255,0.85)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(pt[0] - 11, pt[1]);
	ctx.lineTo(pt[0] - 6, pt[1]);
	ctx.moveTo(pt[0] + 6, pt[1]);
	ctx.lineTo(pt[0] + 11, pt[1]);
	ctx.moveTo(pt[0], pt[1] - 11);
	ctx.lineTo(pt[0], pt[1] - 6);
	ctx.moveTo(pt[0], pt[1] + 6);
	ctx.lineTo(pt[0], pt[1] + 11);
	ctx.stroke();
	if (label) {
		ctx.font = '9px system-ui,sans-serif';
		ctx.fillStyle = '#ffd0dc';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';
		ctx.fillText(label, pt[0] + 9, pt[1] + 7);
	}
	ctx.restore();
}
function est3dDrawGizmo(ctx, projM, viewM, pivot, len, ox, oy, w, h) {
	const axes = [
		[len, 0, 0, '#ff5d5d', 'X'],
		[0, len, 0, '#5dff7e', 'Y'],
		[0, 0, len, '#5da8ff', 'Z'],
	];
	const p0 = est3dProj2(projM, viewM, pivot, w, h);
	if (!p0) return null;
	for (const a of axes) {
		const p1 = est3dProj2(projM, viewM, [pivot[0] + a[0], pivot[1] + a[1], pivot[2] + a[2]], w, h);
		if (!p1) continue;
		ctx.strokeStyle = a[3];
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.moveTo(ox + p0[0], oy + p0[1]);
		ctx.lineTo(ox + p1[0], oy + p1[1]);
		ctx.stroke();
		ctx.fillStyle = a[3];
		ctx.font = 'bold 9px system-ui,sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(a[4], ox + p1[0] + (p1[0] - p0[0]) * 0.12, oy + p1[1] + (p1[1] - p0[1]) * 0.12);
	}
	return [ox + p0[0], oy + p0[1]];
}

function est3dRenderSheet(proj, path, opts) {
	opts = opts || {};
	const eff = est3dEffective(proj, path, null);
	const st = eff.state;
	const u = u3dGet(opts.unit || st.unit || 'm');
	const views = est3dPickViews(opts.views);
	const showPivot = opts.show_pivot !== false;
	const showGrid = opts.show_grid !== false;
	const cell = 336,
		pad = 8,
		title = 30;
	const items = views.length + 1;
	const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(items))));
	const rows = Math.ceil(items / cols);
	const W = cols * cell + (cols + 1) * pad,
		H = title + rows * cell + (rows + 1) * pad;
	const sheet = document.createElement('canvas');
	sheet.width = W;
	sheet.height = H;
	const ctx = sheet.getContext('2d');
	ctx.fillStyle = '#0d1017';
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = '#e8edf7';
	ctx.font = 'bold 13px system-ui,sans-serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	const dimsTxt = `L ${u3dFmt(eff.dims[0], u)}  ×  A ${u3dFmt(eff.dims[1], u)}  ×  P ${u3dFmt(eff.dims[2], u)}`;
	ctx.fillText(
		`ESTUDIO 3D — ${Core.basename(eff.path)}   ·   ${dimsTxt}`,
		pad + 4,
		title / 2 + 2,
		W - 330,
	);
	ctx.fillStyle = 'rgba(150,165,195,0.8)';
	ctx.font = '10px system-ui,sans-serif';
	ctx.textAlign = 'right';
	ctx.fillText(
		eff.triCount.toLocaleString('pt-BR') +
			' tris · pivot [' +
			eff.pivot
				.map(function (v) {
					return u3dVal(v, u);
				})
				.join(' ; ') +
			'] ' +
			u.label,
		W - pad - 4,
		title / 2 + 2,
	);
	const g = est3dGLCtx();
	est3dUpload(g, eff);
	const gutL = 36,
		gutR = 36,
		gutT = 20,
		gutB = 36;
	const pivotHits = [];
	for (let vi = 0; vi < views.length; vi++) {
		const view = views[vi];
		const cx0 = pad + (vi % cols) * (cell + pad),
			cy0 = title + pad + Math.floor(vi / cols) * (cell + pad);
		ctx.fillStyle = '#131826';
		ctx.fillRect(cx0, cy0, cell, cell);
		ctx.strokeStyle = 'rgba(90,110,150,0.35)';
		ctx.strokeRect(cx0 + 0.5, cy0 + 0.5, cell - 1, cell - 1);
		ctx.fillStyle = '#aebedd';
		ctx.font = 'bold 10px system-ui,sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(view.label, cx0 + 8, cy0 + gutT / 2 + 1);
		const ix = cx0 + gutL,
			iy = cy0 + gutT,
			iw = cell - gutL - gutR,
			ih = cell - gutT - gutB;
		let mats;
		if (view.persp) {
			mats = est3dRenderGL(g, eff, view, iw, ih);
			ctx.drawImage(g.canvas, ix, iy);
			if (showGrid) {
				const gy = eff.bboxMin[1];
				const stepM = est3dStep(Math.max(eff.dims[0], eff.dims[2]) / u.f / 4) * u.f;
				const nl = 6;
				const cxw = eff.center[0],
					czw = eff.center[2];
				ctx.strokeStyle = 'rgba(120,140,180,0.35)';
				ctx.lineWidth = 1;
				for (let k = -nl; k <= nl; k++) {
					const a = est3dProj2(
						mats.proj,
						mats.view,
						[cxw + k * stepM, gy, czw - nl * stepM],
						iw,
						ih,
					);
					const b = est3dProj2(
						mats.proj,
						mats.view,
						[cxw + k * stepM, gy, czw + nl * stepM],
						iw,
						ih,
					);
					if (a && b) {
						ctx.beginPath();
						ctx.moveTo(ix + a[0], iy + a[1]);
						ctx.lineTo(ix + b[0], iy + b[1]);
						ctx.stroke();
					}
					const c2 = est3dProj2(
						mats.proj,
						mats.view,
						[cxw - nl * stepM, gy, czw + k * stepM],
						iw,
						ih,
					);
					const d2 = est3dProj2(
						mats.proj,
						mats.view,
						[cxw + nl * stepM, gy, czw + k * stepM],
						iw,
						ih,
					);
					if (c2 && d2) {
						ctx.beginPath();
						ctx.moveTo(ix + c2[0], iy + c2[1]);
						ctx.lineTo(ix + d2[0], iy + d2[1]);
						ctx.stroke();
					}
				}
				ctx.fillStyle = 'rgba(140,160,190,0.7)';
				ctx.font = '9px system-ui,sans-serif';
				ctx.textAlign = 'left';
				ctx.textBaseline = 'alphabetic';
				ctx.fillText(`grade: ${u3dFmt(stepM, u)} por celula`, ix + 4, iy + ih - 6);
			}
		} else {
			const Rv = est3dRight(view);
			const extX = Math.max(est3dExtAlong(eff.dims, Rv), 1e-9),
				extY = Math.max(est3dExtAlong(eff.dims, view.upv), 1e-9);
			const sc = Math.min(iw / (extX * 1.1), ih / (extY * 1.1));
			const Wm = iw / sc,
				Hm = ih / sc;
			const vv = { dir: view.dir, upv: view.upv, W: Wm, H: Hm, lookCenter: eff.center };
			mats = est3dRenderGL(g, eff, vv, iw, ih);
			ctx.drawImage(g.canvas, ix, iy);
			if (showGrid && view.id === 'topo') {
				const stepM2 = est3dStep(Math.max(extX, extY) / u.f / 5) * u.f;
				ctx.strokeStyle = 'rgba(120,140,180,0.22)';
				const x0g = ix + (iw - extX * sc) / 2,
					y0g = iy + (ih - extY * sc) / 2;
				for (let wv = 0; wv <= extX + 1e-9; wv += stepM2) {
					ctx.beginPath();
					ctx.moveTo(x0g + wv * sc, iy);
					ctx.lineTo(x0g + wv * sc, iy + ih);
					ctx.stroke();
				}
				for (let hv = 0; hv <= extY + 1e-9; hv += stepM2) {
					ctx.beginPath();
					ctx.moveTo(ix, y0g + hv * sc);
					ctx.lineTo(ix + iw, y0g + hv * sc);
					ctx.stroke();
				}
			}
			est3dDrawRulers(ctx, ix, iy, iw, ih, sc, u, extX, extY, view.ax, view.ay);
			ctx.fillStyle = 'rgba(150,168,200,0.85)';
			ctx.font = '9px system-ui,sans-serif';
			ctx.textAlign = 'right';
			ctx.textBaseline = 'alphabetic';
			ctx.fillText(`⟵ ${u3dFmt(extX, u)} ⟶`, cx0 + cell - 8, cy0 + gutT - 6);
		}
		if (showPivot && mats) {
			const maxD = Math.max(eff.dims[0], eff.dims[1], eff.dims[2]);
			const pp = est3dDrawGizmo(ctx, mats.proj, mats.view, eff.pivot, maxD * 0.22, ix, iy, iw, ih);
			if (pp) {
				const inside = pp[0] >= ix && pp[0] <= ix + iw && pp[1] >= iy && pp[1] <= iy + ih;
				est3dDrawPivot(
					ctx,
					[
						Math.max(ix + 4, Math.min(ix + iw - 4, pp[0])),
						Math.max(iy + 4, Math.min(iy + ih - 4, pp[1])),
					],
					inside ? 'pivot' : 'pivot (fora da vista)',
				);
				pivotHits.push({
					view: view.id,
					x: Math.round(pp[0] - ix),
					y: Math.round(pp[1] - iy),
					inside: inside,
				});
			}
		}
	}
	const ii = views.length;
	const icx = pad + (ii % cols) * (cell + pad),
		icy = title + pad + Math.floor(ii / cols) * (cell + pad);
	ctx.fillStyle = '#10141f';
	ctx.fillRect(icx, icy, cell, cell);
	ctx.strokeStyle = 'rgba(90,110,150,0.35)';
	ctx.strokeRect(icx + 0.5, icy + 0.5, cell - 1, cell - 1);
	const nrm = [0, 1, 2].map(function (i) {
		const d = eff.origMax[i] - eff.origMin[i];
		return d > 1e-9 ? (eff.pivot[i] - eff.origMin[i]) / d : 0.5;
	});
	const lines = [
		'INFO',
		`arquivo: ${eff.path} (${eff.ext.slice(1).toUpperCase()} · ${mvSize(eff.bytes)})`,
		'geometria: ' +
			eff.vertCount.toLocaleString('pt-BR') +
			' vertices · ' +
			eff.triCount.toLocaleString('pt-BR') +
			' triangulos' +
			(eff.drawnTri < eff.triCount
				? ` (render decimado: ${eff.drawnTri.toLocaleString('pt-BR')})`
				: ''),
		'',
		`dimensoes (${u.label}):`,
		'  largura  X: ' + u3dFmt(eff.dims[0], u),
		'  altura   Y: ' + u3dFmt(eff.dims[1], u),
		'  profund. Z: ' + u3dFmt(eff.dims[2], u),
		`  (em metros: ${eff.dims
			.map(function (d) {
				return d.toFixed(4);
			})
			.join(' × ')})`,
		'',
		`pivot (${u.label}, espaco do arquivo):`,
		`  [${eff.pivot
			.map(function (v) {
				return u3dVal(v, u);
			})
			.join(' ; ')}]`,
		`  normalizado no bbox: [${nrm
			.map(function (v) {
				return v.toFixed(3);
			})
			.join(' ; ')}]`,
		'',
		`estado: escala ×${+st.scale.toPrecision(6)} · rotacao [${st.rotation.join('°, ')}°]${st.applied ? ' · BAKE aplicado' : ''}`,
		eff.unitNote ? 'atencao: ' + eff.unitNote : null,
	].filter(function (x) {
		return x !== null;
	});
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	let ly = icy + 10;
	for (const ln of lines) {
		ctx.font =
			ln === 'INFO'
				? 'bold 11px ui-monospace,Menlo,monospace'
				: '10px ui-monospace,Menlo,monospace';
		ctx.fillStyle = ln.indexOf('atencao') === 0 ? '#ffd28a' : '#c4d0e6';
		ctx.fillText(ln, icx + 10, ly, cell - 20);
		ly += ln === '' ? 6 : 15;
	}
	const fmt = opts.format === 'png' ? 'image/png' : 'image/jpeg';
	return {
		dataUrl: sheet.toDataURL(fmt, 0.9),
		eff: eff,
		unit: u,
		pivotHits: pivotHits,
		w: W,
		h: H,
	};
}

function est3dPresets(origMin, origMax) {
	const mid = [
		(origMin[0] + origMax[0]) / 2,
		(origMin[1] + origMax[1]) / 2,
		(origMin[2] + origMax[2]) / 2,
	];
	return {
		origem: [0, 0, 0],
		origin: [0, 0, 0],
		centro: mid.slice(),
		center: mid.slice(),
		'base-centro': [mid[0], origMin[1], mid[2]],
		'bottom-center': [mid[0], origMin[1], mid[2]],
		'topo-centro': [mid[0], origMax[1], mid[2]],
		'top-center': [mid[0], origMax[1], mid[2]],
		'dobradica-esquerda': [origMin[0], mid[1], mid[2]],
		'hinge-left': [origMin[0], mid[1], mid[2]],
		'edge-left-center': [origMin[0], mid[1], mid[2]],
		'dobradica-direita': [origMax[0], mid[1], mid[2]],
		'hinge-right': [origMax[0], mid[1], mid[2]],
		'edge-right-center': [origMax[0], mid[1], mid[2]],
		'dobradica-topo': [mid[0], origMax[1], mid[2]],
		'hinge-top': [mid[0], origMax[1], mid[2]],
		'edge-left-bottom': [origMin[0], origMin[1], mid[2]],
		'edge-right-bottom': [origMax[0], origMin[1], mid[2]],
		'edge-front-bottom': [mid[0], origMin[1], origMax[2]],
		'edge-back-bottom': [mid[0], origMin[1], origMin[2]],
		'canto-min': [origMin[0], origMin[1], origMin[2]],
		'corner-min': [origMin[0], origMin[1], origMin[2]],
		'canto-max': [origMax[0], origMax[1], origMax[2]],
		'corner-max': [origMax[0], origMax[1], origMax[2]],
	};
}

function est3dGlbParts(bytes) {
	const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Cabecalho GLB invalido');
	const total = Math.min(dv.getUint32(8, true), bytes.length);
	let off = 12,
		json = null,
		bin = null;
	while (off + 8 <= total) {
		const clen = dv.getUint32(off, true);
		const ctype = dv.getUint32(off + 4, true);
		const cstart = off + 8;
		if (cstart + clen > bytes.length) break;
		const chunk = bytes.subarray(cstart, cstart + clen);
		if (ctype === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
		else if (ctype === 0x004e4942) bin = chunk;
		off = cstart + clen;
	}
	if (!json) throw new Error('GLB sem bloco JSON');
	return { json: json, bin: bin };
}
function est3dPackGLB(json, bin) {
	let jb = new TextEncoder().encode(JSON.stringify(json));
	const jpad = (4 - (jb.length % 4)) % 4;
	if (jpad) {
		const nb = new Uint8Array(jb.length + jpad);
		nb.set(jb);
		for (let i = 0; i < jpad; i++) nb[jb.length + i] = 0x20;
		jb = nb;
	}
	let bb = bin && bin.length ? bin : null;
	if (bb) {
		const bpad = (4 - (bb.length % 4)) % 4;
		if (bpad) {
			const n2 = new Uint8Array(bb.length + bpad);
			n2.set(bb);
			bb = n2;
		}
	}
	const total = 12 + 8 + jb.length + (bb ? 8 + bb.length : 0);
	const out = new Uint8Array(total);
	const dv = new DataView(out.buffer);
	dv.setUint32(0, 0x46546c67, true);
	dv.setUint32(4, 2, true);
	dv.setUint32(8, total, true);
	dv.setUint32(12, jb.length, true);
	dv.setUint32(16, 0x4e4f534a, true);
	out.set(jb, 20);
	if (bb) {
		const o = 20 + jb.length;
		dv.setUint32(o, bb.length, true);
		dv.setUint32(o + 4, 0x004e4942, true);
		out.set(bb, o + 8);
	}
	return out;
}
function est3dBakeGltfJson(json, pivot, rotDeg, scale) {
	json.nodes = json.nodes || [];
	if (!json.scenes || !json.scenes.length) json.scenes = [{ nodes: [] }];
	const si = json.scene != null && json.scenes[json.scene] ? json.scene : 0;
	const scene = json.scenes[si];
	const roots = (scene.nodes || []).slice();
	const inner = { name: 'AuroraPivotOffset', translation: [-pivot[0], -pivot[1], -pivot[2]] };
	if (roots.length) inner.children = roots;
	json.nodes.push(inner);
	const outer = { name: 'AuroraPivot', children: [json.nodes.length - 1] };
	if (rotDeg[0] || rotDeg[1] || rotDeg[2]) outer.rotation = est3dQuat(rotDeg);
	if (scale !== 1) outer.scale = [scale, scale, scale];
	json.nodes.push(outer);
	scene.nodes = [json.nodes.length - 1];
	return json;
}
function est3dBakeOBJ(text, pivot, rotDeg, scale) {
	const R = est3dEuler(rotDeg);
	const s = scale;
	return text
		.split('\n')
		.map(function (ln) {
			const t = ln.trim();
			if (/^v[ \t]/.test(t)) {
				const p = t.split(/\s+/);
				const x = +p[1] - pivot[0],
					y = +p[2] - pivot[1],
					z = +p[3] - pivot[2];
				if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return ln;
				const tx = (R[0] * x + R[1] * y + R[2] * z) * s,
					ty = (R[3] * x + R[4] * y + R[5] * z) * s,
					tz = (R[6] * x + R[7] * y + R[8] * z) * s;
				return `v ${tx.toFixed(6)} ${ty.toFixed(6)} ${tz.toFixed(6)}${p.length > 4 ? ' ' + p.slice(4).join(' ') : ''}`;
			}
			if (/^vn[ \t]/.test(t)) {
				const p = t.split(/\s+/);
				const x = +p[1],
					y = +p[2],
					z = +p[3];
				if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return ln;
				const tx = R[0] * x + R[1] * y + R[2] * z,
					ty = R[3] * x + R[4] * y + R[5] * z,
					tz = R[6] * x + R[7] * y + R[8] * z;
				return `vn ${tx.toFixed(6)} ${ty.toFixed(6)} ${tz.toFixed(6)}`;
			}
			return ln;
		})
		.join('\n');
}
function est3dContent(sheet, text) {
	const m = String(sheet.dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
	const content = [];
	if (m) content.push({ type: 'image', data: m[2], mimeType: m[1] });
	content.push({ type: 'text', text: text });
	return { __content: content };
}

function est3dText(sheet) {
	const eff = sheet.eff,
		u = sheet.unit,
		st = eff.state;
	const nrm = [0, 1, 2].map(function (i) {
		const d = eff.origMax[i] - eff.origMin[i];
		return d > 1e-9 ? ((eff.pivot[i] - eff.origMin[i]) / d).toFixed(3) : '0.500';
	});
	return (
		'FICHA TECNICA — ' +
		eff.path +
		'\n' +
		'Dimensoes: L ' +
		u3dFmt(eff.dims[0], u) +
		' x A ' +
		u3dFmt(eff.dims[1], u) +
		' x P ' +
		u3dFmt(eff.dims[2], u) +
		'  (em metros: ' +
		eff.dims
			.map(function (d) {
				return d.toFixed(4);
			})
			.join(' x ') +
		')\n' +
		'BBox no espaco do arquivo (m): min [' +
		eff.bboxMin
			.map(function (v) {
				return +v.toFixed(4);
			})
			.join(', ') +
		']  max [' +
		eff.bboxMax
			.map(function (v) {
				return +v.toFixed(4);
			})
			.join(', ') +
		']\n' +
		'Pivot: [' +
		eff.pivot
			.map(function (v) {
				return u3dVal(v, u);
			})
			.join(' ; ') +
		'] ' +
		u.label +
		'  | normalizado no bbox [' +
		nrm.join(' ; ') +
		']  | em metros [' +
		eff.pivot
			.map(function (v) {
				return +v.toFixed(4);
			})
			.join(', ') +
		']\n' +
		'Geometria: ' +
		eff.vertCount +
		' vertices, ' +
		eff.triCount +
		' triangulos' +
		(eff.drawnTri < eff.triCount ? ' (render decimado, medidas exatas)' : '') +
		'\n' +
		'Estado: escala x' +
		+st.scale.toPrecision(6) +
		', rotacao [' +
		st.rotation.join(', ') +
		'] graus' +
		(st.applied ? ', bake ja aplicado' : '') +
		'\n' +
		(u.key === 'stud' ? `Escala stud: 1 stud = ${U3D.stud.f} m\n` : '') +
		(eff.unitNote ? `ATENCAO: ${eff.unitNote}\n` : '') +
		('Reguas: comecam em 0 na borda minima do modelo em cada vista. Presets de pivot: origem, ' +
			'centro, base-centro, topo-centro, dobradica-esquerda, dobradica-direita, dobradica-topo,' +
			' edge-left-bottom, edge-right-bottom, edge-front-bottom, edge-back-bottom, canto-min, ' +
			'canto-max.')
	);
}
function est3dHuman(ctx, cx, gy, sc) {
	const h = 1.75 * sc;
	const r = h * 0.075;
	ctx.save();
	ctx.strokeStyle = '#9fb2d6';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(cx, gy - h + r, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cx, gy - h + 2 * r);
	ctx.lineTo(cx, gy - h * 0.42);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cx - h * 0.16, gy - h * 0.72);
	ctx.lineTo(cx + h * 0.16, gy - h * 0.72);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cx, gy - h * 0.42);
	ctx.lineTo(cx - h * 0.11, gy);
	ctx.moveTo(cx, gy - h * 0.42);
	ctx.lineTo(cx + h * 0.11, gy);
	ctx.stroke();
	ctx.restore();
}
function est3dCompareSheet(proj, paths, opts) {
	opts = opts || {};
	const u = u3dGet(opts.unit || 'm');
	const showHuman = opts.human !== false;
	const effs = paths.map(function (p) {
		return est3dEffective(proj, p, null);
	});
	const innerH = 380,
		top = 40,
		base = 56;
	let maxH = showHuman ? 1.75 : 1e-9;
	for (const e of effs) maxH = Math.max(maxH, e.dims[1]);
	let sc = innerH / (maxH * 1.1);
	const colMax = 320;
	for (const e of effs) sc = Math.min(sc, (colMax - 24) / Math.max(e.dims[0] * 1.1, 1e-9));
	const cols = effs.map(function (e) {
		return Math.max(96, Math.ceil(e.dims[0] * sc) + 40);
	});
	let W = 64;
	for (const c of cols) W += c + 10;
	const humanW = showHuman ? Math.max(80, Math.ceil(0.45 * 1.75 * sc)) : 0;
	if (showHuman) W += humanW + 10;
	const H = top + innerH + base;
	const sheet = document.createElement('canvas');
	sheet.width = W;
	sheet.height = H;
	const ctx = sheet.getContext('2d');
	ctx.fillStyle = '#0d1017';
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = '#e8edf7';
	ctx.font = 'bold 12px system-ui,sans-serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillText(`COMPARACAO DE ESCALA — vista frontal, mesma escala (${u.label})`, 10, top / 2);
	const gy = top + innerH;
	ctx.strokeStyle = 'rgba(160,180,215,0.6)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(46, gy + 0.5);
	ctx.lineTo(W - 8, gy + 0.5);
	ctx.stroke();
	const stepU = est3dStep(innerH / sc / u.f / 6);
	ctx.fillStyle = 'rgba(180,195,220,0.95)';
	ctx.font = '9px ui-monospace,monospace';
	ctx.textAlign = 'right';
	ctx.textBaseline = 'middle';
	for (let hU = 0; hU * u.f * sc <= innerH + 1e-9; hU += stepU) {
		const py = gy - hU * u.f * sc;
		ctx.beginPath();
		ctx.moveTo(46, py);
		ctx.lineTo(40, py);
		ctx.stroke();
		ctx.fillText(String(+hU.toFixed(4)).replace('.', ','), 38, py);
	}
	const g = est3dGLCtx();
	let x = 64;
	for (let i2 = 0; i2 < effs.length; i2++) {
		const e = effs[i2];
		const cw = cols[i2];
		est3dUpload(g, e);
		const vv = {
			dir: [0, 0, 1],
			upv: [0, 1, 0],
			W: cw / sc,
			H: innerH / sc,
			lookCenter: [e.center[0], e.bboxMin[1] + innerH / sc / 2, e.center[2]],
		};
		est3dRenderGL(g, e, vv, cw, innerH);
		ctx.drawImage(g.canvas, x, top);
		ctx.strokeStyle = 'rgba(90,110,150,0.35)';
		ctx.strokeRect(x + 0.5, top + 0.5, cw - 1, innerH - 1);
		ctx.fillStyle = '#c4d0e6';
		ctx.font = '10px system-ui,sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText(Core.basename(e.path), x + cw / 2, gy + 8, cw);
		ctx.fillStyle = 'rgba(150,168,200,0.9)';
		ctx.fillText(`A ${u3dFmt(e.dims[1], u)} | L ${u3dFmt(e.dims[0], u)}`, x + cw / 2, gy + 22, cw);
		x += cw + 10;
	}
	if (showHuman) {
		est3dHuman(ctx, x + humanW / 2, gy, sc);
		ctx.fillStyle = '#9fb2d6';
		ctx.font = '10px system-ui,sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText('humano', x + humanW / 2, gy + 8);
		ctx.fillText('1,75 m', x + humanW / 2, gy + 22);
	}
	return { dataUrl: sheet.toDataURL('image/jpeg', 0.9), effs: effs, unit: u, sc: sc };
}

function MeshViewer(canvas, geo) {
	const gl = canvas.getContext('webgl', {
		antialias: true,
		alpha: true,
		preserveDrawingBuffer: false,
	});
	if (!gl) throw new Error('WebGL não disponível neste navegador');
	function sh(type, src) {
		const s = gl.createShader(type);
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
			throw new Error(gl.getShaderInfoLog(s) || 'erro de shader');
		return s;
	}
	const vs = [
		'attribute vec3 aPos;',
		'attribute vec3 aNormal;',
		'uniform mat4 uProj;',
		'uniform mat4 uView;',
		'varying vec3 vN;',
		'varying vec3 vV;',
		'void main(){',
		'vec4 vp=uView*vec4(aPos,1.0);',
		'gl_Position=uProj*vp;',
		'vN=aNormal;',
		'vV=normalize(-vp.xyz);',
		'}',
	].join('\n');
	const fs = [
		'precision mediump float;',
		'varying vec3 vN;',
		'varying vec3 vV;',
		'uniform vec3 uColor;',
		'void main(){',
		'vec3 N=normalize(vN);',
		'if(dot(N,vV)<0.0)N=-N;',
		'vec3 L=normalize(vec3(0.5,0.85,0.65));',
		'float d=max(dot(N,L),0.0);',
		'float hh=0.5+0.5*N.y;',
		'vec3 col=uColor*(0.3+0.7*d)*mix(0.7,1.08,hh);',
		'float rim=pow(1.0-max(dot(N,vV),0.0),2.5)*0.22;',
		'col+=rim;',
		'gl_FragColor=vec4(col,1.0);',
		'}',
	].join('\n');
	const prog = gl.createProgram();
	gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
	gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
		throw new Error(gl.getProgramInfoLog(prog) || 'erro de link');
	gl.useProgram(prog);
	const aPos = gl.getAttribLocation(prog, 'aPos'),
		aNormal = gl.getAttribLocation(prog, 'aNormal');
	const uProj = gl.getUniformLocation(prog, 'uProj'),
		uView = gl.getUniformLocation(prog, 'uView'),
		uColor = gl.getUniformLocation(prog, 'uColor');
	const pbuf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
	gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
	const nbuf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, nbuf);
	gl.bufferData(gl.ARRAY_BUFFER, geo.nrm, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(aNormal);
	gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
	gl.enable(gl.DEPTH_TEST);
	gl.disable(gl.CULL_FACE);
	gl.clearColor(0, 0, 0, 0);
	const count = geo.pos.length / 3;
	let theta = 0.7,
		phi = 0.5,
		radius = geo.radius * 2.6;
	const minR = geo.radius * 0.35,
		maxR = geo.radius * 40;
	let auto = true,
		dragging = false,
		lx = 0,
		ly = 0,
		raf = 0,
		alive = true;
	function accent() {
		try {
			return mvHexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--acc'));
		} catch (e) {
			return [0.36, 0.61, 1.0];
		}
	}
	let col = accent();
	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = canvas.clientWidth || 300,
			h = canvas.clientHeight || 300;
		const W = Math.max(1, Math.round(w * dpr)),
			H = Math.max(1, Math.round(h * dpr));
		if (canvas.width !== W || canvas.height !== H) {
			canvas.width = W;
			canvas.height = H;
		}
		gl.viewport(0, 0, canvas.width, canvas.height);
	}
	function render() {
		if (!alive) return;
		resize();
		const asp = canvas.width / canvas.height || 1;
		const proj = m4perspective(
			(50 * Math.PI) / 180,
			asp,
			Math.max(0.001, geo.radius * 0.01),
			geo.radius * 200,
		);
		const eye = [
			radius * Math.cos(phi) * Math.sin(theta),
			radius * Math.sin(phi),
			radius * Math.cos(phi) * Math.cos(theta),
		];
		const view = m4lookAt(eye, [0, 0, 0], [0, 1, 0]);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.uniformMatrix4fv(uProj, false, proj);
		gl.uniformMatrix4fv(uView, false, view);
		gl.uniform3f(uColor, col[0], col[1], col[2]);
		gl.drawArrays(gl.TRIANGLES, 0, count);
	}
	function loop() {
		if (!alive) return;
		if (auto && !dragging && !mvReduceMotion()) theta += 0.0045;
		render();
		raf = requestAnimationFrame(loop);
	}
	function down(e) {
		dragging = true;
		lx = e.clientX;
		ly = e.clientY;
		try {
			canvas.setPointerCapture(e.pointerId);
		} catch (_) {
			ignorarErro(_, 'down');
		}
	}
	function move(e) {
		if (!dragging) return;
		const dx = e.clientX - lx,
			dy = e.clientY - ly;
		lx = e.clientX;
		ly = e.clientY;
		theta -= dx * 0.01;
		phi = Math.max(-1.4, Math.min(1.4, phi + dy * 0.01));
	}
	function up() {
		dragging = false;
	}
	function wheel(e) {
		e.preventDefault();
		radius = Math.max(minR, Math.min(maxR, radius * (e.deltaY > 0 ? 1.12 : 0.89)));
	}
	canvas.addEventListener('pointerdown', down);
	window.addEventListener('pointermove', move);
	window.addEventListener('pointerup', up);
	canvas.addEventListener('wheel', wheel, { passive: false });
	raf = requestAnimationFrame(loop);
	return {
		dispose: function () {
			alive = false;
			cancelAnimationFrame(raf);
			canvas.removeEventListener('pointerdown', down);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			canvas.removeEventListener('wheel', wheel);
			try {
				const ext = gl.getExtension('WEBGL_lose_context');
				if (ext) ext.loseContext();
			} catch (_) {
				ignorarErro(_, 'dispose');
			}
		},
		reset: function () {
			theta = 0.7;
			phi = 0.5;
			radius = geo.radius * 2.6;
		},
		toggleAuto: function () {
			auto = !auto;
			return auto;
		},
	};
}
function mvBar(path, icon, meta, buttons) {
	const bar = document.createElement('div');
	bar.className = 'mv-bar';
	let bh = '';
	for (let i = 0; i < buttons.length; i++) {
		const b = buttons[i];
		bh += `<button class="mv-btn${b.on ? ' on' : ''}" data-mv="${b.id}">${esc(b.label)}</button>`;
	}
	bar.innerHTML = `<span class="mv-ico" style="color:${colorOfExt(path)}">${fileIcon(path, false)}</span>\
<span class="mv-name">${esc(Core.basename(path))}</span><span class="mv-meta">${esc(meta)}</span><span \
class="mv-spacer"></span>${bh}`;
	return bar;
}
function openMediaPreview(proj, path, f) {
	const mv = el.mediaView;
	mv.innerHTML = '';
	const ext = (Core.extname(path) || '').toLowerCase();
	const bytes = fileBytes(f);
	const size = mvSize(bytes.length);
	if (isImageExt(ext)) {
		const url = URL.createObjectURL(new Blob([bytes], { type: imgMime(ext) }));
		__media.url = url;
		mv.appendChild(mvBar(path, 'img', size + ' · imagem', []));
		const stage = document.createElement('div');
		stage.className = 'mv-stage mv-checker';
		const img = document.createElement('img');
		img.className = 'mv-img';
		img.alt = Core.basename(path);
		img.onload = function () {
			const meta = mv.querySelector('.mv-meta');
			if (meta)
				meta.textContent = size + ' · ' + img.naturalWidth + ' × ' + img.naturalHeight + ' px';
		};
		img.onerror = function () {
			stage.innerHTML = '<div class="mv-msg">Não foi possível exibir esta imagem</div>';
		};
		img.src = url;
		let fit = true;
		img.title = 'Clique para ver em tamanho real';
		img.addEventListener('click', function () {
			fit = !fit;
			img.classList.toggle('actual', !fit);
		});
		stage.appendChild(img);
		mv.appendChild(stage);
		const hint = document.createElement('div');
		hint.className = 'mv-hint';
		hint.textContent = 'Clique na imagem para alternar entre ajustar e tamanho real';
		mv.appendChild(hint);
		return;
	}
	if (is3DExt(ext)) {
		if (ext === '.fbx') {
			mv.appendChild(mvBar(path, 'spark', size + ' · 3D (FBX)', []));
			const s = document.createElement('div');
			s.className = 'mv-stage';
			s.innerHTML =
				'<div class="mv-msg"><b>Preview de FBX não disponível offline</b><br>O formato FBX é ' +
				'proprietário e exigiria uma biblioteca pesada para ler aqui dentro. Converta o modelo ' +
				'para <b>.glb</b>, <b>.gltf</b>, <b>.obj</b> ou <b>.stl</b> para ver o preview 3D.<br>' +
				'<span class="mv-sub">Dica: no Blender use Arquivo → Exportar → glTF 2.0 (.glb).</span>' +
				'</div>';
			mv.appendChild(s);
			return;
		}
		let geo;
		try {
			geo = load3D(ext, f, proj, path);
		} catch (e) {
			mv.appendChild(mvBar(path, 'spark', size + ' · 3D', []));
			const s = document.createElement('div');
			s.className = 'mv-stage';
			s.innerHTML = `<div class="mv-msg"><b>Não foi possível abrir o modelo 3D</b><br>${esc((e && e.message) || 'Erro desconhecido')}</div>`;
			mv.appendChild(s);
			return;
		}
		const tris = geo.triCount.toLocaleString('pt-BR');
		const bar = mvBar(path, 'spark', size + ' · ' + tris + ' triângulos', [
			{ id: 'reset', label: 'Resetar vista' },
			{ id: 'auto', label: 'Auto-girar', on: true },
		]);
		mv.appendChild(bar);
		const stage = document.createElement('div');
		stage.className = 'mv-stage mv-3d';
		const canvas = document.createElement('canvas');
		canvas.className = 'mv-canvas';
		stage.appendChild(canvas);
		mv.appendChild(stage);
		const hint = document.createElement('div');
		hint.className = 'mv-hint';
		hint.textContent =
			'Arraste para girar · role o mouse para aproximar · modelo exibido sem textura';
		mv.appendChild(hint);
		let viewer;
		try {
			viewer = new MeshViewer(canvas, geo);
		} catch (e) {
			stage.classList.remove('mv-3d');
			stage.innerHTML = `<div class="mv-msg"><b>WebGL indisponível</b><br>${esc((e && e.message) || '')}</div>`;
			return;
		}
		__media.dispose = viewer.dispose;
		const rb = bar.querySelector('[data-mv="reset"]');
		if (rb)
			rb.addEventListener('click', function () {
				viewer.reset();
			});
		const ab = bar.querySelector('[data-mv="auto"]');
		if (ab)
			ab.addEventListener('click', function () {
				const on = viewer.toggleAuto();
				ab.classList.toggle('on', on);
			});
		return;
	}
	const mime = Core.getMime(path);
	const AUD = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus'];
	const VID = ['.mp4', '.webm', '.mov', '.m4v'];
	if (AUD.includes(ext) || VID.includes(ext) || ext === '.pdf') {
		const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
		__media.url = url;
		const isV = VID.includes(ext),
			isP = ext === '.pdf';
		mv.appendChild(mvBar(path, 'img', size + (isP ? ' · PDF' : isV ? ' · vídeo' : ' · áudio'), []));
		const stage = document.createElement('div');
		stage.className = 'mv-stage';
		if (isP) {
			const fr = document.createElement('iframe');
			fr.src = url;
			fr.style.cssText =
				'width:100%;height:100%;min-height:420px;border:0;background:#fff;border-radius:8px';
			stage.appendChild(fr);
		} else if (isV) {
			const v = document.createElement('video');
			v.src = url;
			v.controls = true;
			v.style.cssText = 'max-width:100%;max-height:100%;border-radius:8px';
			stage.appendChild(v);
		} else {
			const au = document.createElement('audio');
			au.src = url;
			au.controls = true;
			au.style.cssText = 'width:90%';
			stage.appendChild(au);
		}
		mv.appendChild(stage);
		const hint = document.createElement('div');
		hint.className = 'mv-hint';
		hint.textContent = `Reprodução local do arquivo (${mime})`;
		mv.appendChild(hint);
		return;
	}
	mv.appendChild(mvBar(path, 'img', size + ' · binário · ' + mime, []));
	const stage = document.createElement('div');
	stage.className = 'mv-stage';
	const LIM = 16384;
	const n = Math.min(bytes.length, LIM);
	const rows = [];
	for (let o = 0; o < n; o += 16) {
		let hx = '',
			as = '';
		for (let i = 0; i < 16; i++) {
			if (o + i < n) {
				const b = bytes[o + i];
				hx += (b < 16 ? '0' : '') + b.toString(16) + ' ';
				as += b >= 32 && b < 127 ? String.fromCharCode(b) : '·';
			} else hx += '   ';
			if (i === 7) hx += ' ';
		}
		rows.push(('00000000' + o.toString(16)).slice(-8) + '  ' + hx + ' ' + as);
	}
	const pre = document.createElement('pre');
	pre.textContent =
		(n ? rows.join('\n') : '(arquivo vazio)') +
		(bytes.length > LIM
			? `\n… (${mvSize(bytes.length - LIM)} restantes — o arquivo completo pode ser lido pelo MCP em base64)`
			: '');
	pre.style.cssText =
		'width:100%;height:100%;margin:0;overflow:auto;font:11px/1.5 ui-monospace,Menlo,Consolas,' +
		'monospace;color:var(--txt-2,#9aa3b2);background:transparent;padding:10px 14px;' +
		'box-sizing:border-box;user-select:text;white-space:pre';
	stage.appendChild(pre);
	mv.appendChild(stage);
	const hint = document.createElement('div');
	hint.className = 'mv-hint';
	hint.textContent =
		'Leitura hexadecimal (' +
		(bytes.length > LIM ? `primeiros ${mvSize(n)} de ${size}` : size) +
		') · agentes MCP leem o arquivo completo via read_file (base64)';
	mv.appendChild(hint);
}

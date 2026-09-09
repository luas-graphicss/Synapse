window.AURORA_FORGE_SRC = String.raw`var AuroraForge = (function () {
	'use strict';
	var VERSION = '1.1';
	function isNum(v) {
		return typeof v === 'number' && isFinite(v);
	}
	function clamp(v, a, b) {
		return v < a ? a : v > b ? b : v;
	}
	function lerp(a, b, t) {
		return a + (b - a) * t;
	}
	function smoothstep(t) {
		t = clamp(t, 0, 1);
		return t * t * (3 - 2 * t);
	}
	var DEG = Math.PI / 180;
	function v3(x, y, z) {
		return [x, y, z];
	}
	function vadd(a, b) {
		return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
	}
	function vsub(a, b) {
		return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
	}
	function vmul(a, s) {
		return [a[0] * s, a[1] * s, a[2] * s];
	}
	function vdot(a, b) {
		return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	}
	function vcross(a, b) {
		return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
	}
	function vlen(a) {
		return Math.sqrt(vdot(a, a));
	}
	function vnorm(a) {
		var l = vlen(a);
		return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
	}
	function vlerp(a, b, t) {
		return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
	}
	function mIdent() {
		return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
	}
	function mMul(a, b) {
		var o = new Array(16);
		for (var c = 0; c < 4; c++)
			for (var r = 0; r < 4; r++) {
				var s = 0;
				for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
				o[c * 4 + r] = s;
			}
		return o;
	}
	function mTranslate(x, y, z) {
		var m = mIdent();
		m[12] = x;
		m[13] = y;
		m[14] = z;
		return m;
	}
	function mScale(x, y, z) {
		var m = mIdent();
		m[0] = x;
		m[5] = y;
		m[10] = z;
		return m;
	}
	function mRotAxis(axis, deg) {
		var a = vnorm(axis),
			c = Math.cos(deg * DEG),
			s = Math.sin(deg * DEG),
			t = 1 - c,
			x = a[0],
			y = a[1],
			z = a[2];
		return [
			t * x * x + c,
			t * x * y + s * z,
			t * x * z - s * y,
			0,
			t * x * y - s * z,
			t * y * y + c,
			t * y * z + s * x,
			0,
			t * x * z + s * y,
			t * y * z - s * x,
			t * z * z + c,
			0,
			0,
			0,
			0,
			1,
		];
	}
	function mApplyP(m, p) {
		return [
			m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
			m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
			m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
		];
	}
	function mApplyN(m, n) {
		return vnorm([
			m[0] * n[0] + m[4] * n[1] + m[8] * n[2],
			m[1] * n[0] + m[5] * n[1] + m[9] * n[2],
			m[2] * n[0] + m[6] * n[1] + m[10] * n[2],
		]);
	}
	function mulberry32(seed) {
		var t = seed >>> 0;
		return function () {
			t = (t + 0x6d2b79f5) >>> 0;
			var r = t;
			r = Math.imul(r ^ (r >>> 15), r | 1);
			r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
			return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
		};
	}
	function hash2i(x, y, seed) {
		var h = (x * 374761393 + y * 668265263 + (seed | 0) * 1442695040) | 0;
		h = (h ^ (h >>> 13)) | 0;
		h = Math.imul(h, 1274126177);
		return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	}
	function vnoise2(x, y, seed) {
		var xi = Math.floor(x),
			yi = Math.floor(y),
			xf = x - xi,
			yf = y - yi;
		var a = hash2i(xi, yi, seed),
			b = hash2i(xi + 1, yi, seed),
			c = hash2i(xi, yi + 1, seed),
			d = hash2i(xi + 1, yi + 1, seed);
		var u = smoothstep(xf),
			v = smoothstep(yf);
		return lerp(lerp(a, b, u), lerp(c, d, u), v);
	}
	function fbm2(x, y, seed, oct, lac, gain) {
		oct = oct || 4;
		lac = lac || 2;
		gain = gain || 0.5;
		var s = 0,
			a = 0.5,
			f = 1,
			tot = 0;
		for (var i = 0; i < oct; i++) {
			s += a * vnoise2(x * f, y * f, seed + i * 101);
			tot += a;
			a *= gain;
			f *= lac;
		}
		return s / tot;
	}
	function worley2(x, y, seed) {
		var xi = Math.floor(x),
			yi = Math.floor(y),
			best = 8,
			second = 8;
		for (var j = -1; j <= 1; j++)
			for (var i = -1; i <= 1; i++) {
				var cx = xi + i,
					cy = yi + j;
				var px = cx + hash2i(cx, cy, seed),
					py = cy + hash2i(cx, cy, seed + 77);
				var d = Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
				if (d < best) {
					second = best;
					best = d;
				} else if (d < second) second = d;
			}
		return { f1: clamp(best, 0, 1), f2: clamp(second, 0, 1) };
	}
	function ridged2(x, y, seed, oct) {
		oct = oct || 4;
		var s = 0,
			a = 0.5,
			f = 1,
			tot = 0;
		for (var i = 0; i < oct; i++) {
			var n = 1 - Math.abs(2 * vnoise2(x * f, y * f, seed + i * 57) - 1);
			s += a * n * n;
			tot += a;
			a *= 0.5;
			f *= 2;
		}
		return s / tot;
	}
	function parseColor(c) {
		if (Array.isArray(c)) {
			return [c[0] || 0, c[1] || 0, c[2] || 0, c.length > 3 && isNum(c[3]) ? c[3] : 1];
		}
		if (typeof c === 'number') {
			return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, 1];
		}
		if (typeof c === 'string') {
			var s = c.trim().replace(/^#/, '');
			if (/^[0-9a-f]{3}$/i.test(s)) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
			if (/^[0-9a-f]{6}$/i.test(s)) s += 'ff';
			if (/^[0-9a-f]{8}$/i.test(s)) {
				return [
					parseInt(s.slice(0, 2), 16) / 255,
					parseInt(s.slice(2, 4), 16) / 255,
					parseInt(s.slice(4, 6), 16) / 255,
					parseInt(s.slice(6, 8), 16) / 255,
				];
			}
			throw new Error('Cor invalida: ' + c + ' (use "#rrggbb", [r,g,b] 0..1 ou 0xRRGGBB)');
		}
		throw new Error('Cor invalida: ' + c);
	}
	function hsl(h, s, l) {
		h = (((h % 360) + 360) % 360) / 360;
		var q = l < 0.5 ? l * (1 + s) : l + s - l * s,
			p = 2 * l - q;
		function f(t) {
			t = ((t % 1) + 1) % 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		}
		return [f(h + 1 / 3), f(h), f(h - 1 / 3), 1];
	}

	function Mesh(name) {
		this.__isMesh = true;
		this.name = name || 'mesh';
		this.pos = [];
		this.nrm = null;
		this.uv = null;
		this.idx = [];
	}
	Mesh.prototype.vertCount = function () {
		return this.pos.length / 3;
	};
	Mesh.prototype.triCount = function () {
		return this.idx.length / 3;
	};
	Mesh.prototype.clone = function () {
		var m = new Mesh(this.name);
		m.pos = this.pos.slice();
		m.nrm = this.nrm ? this.nrm.slice() : null;
		m.uv = this.uv ? this.uv.slice() : null;
		m.idx = this.idx.slice();
		return m;
	};
	Mesh.prototype.transform = function (mat) {
		var p = this.pos,
			n = this.nrm;
		for (var i = 0; i < p.length; i += 3) {
			var t = mApplyP(mat, [p[i], p[i + 1], p[i + 2]]);
			p[i] = t[0];
			p[i + 1] = t[1];
			p[i + 2] = t[2];
		}
		if (n)
			for (var j = 0; j < n.length; j += 3) {
				var tn = mApplyN(mat, [n[j], n[j + 1], n[j + 2]]);
				n[j] = tn[0];
				n[j + 1] = tn[1];
				n[j + 2] = tn[2];
			}
		var det =
			mat[0] * (mat[5] * mat[10] - mat[9] * mat[6]) -
			mat[4] * (mat[1] * mat[10] - mat[9] * mat[2]) +
			mat[8] * (mat[1] * mat[6] - mat[5] * mat[2]);
		if (det < 0) this.flipWinding();
		return this;
	};
	Mesh.prototype.flipWinding = function () {
		var ix = this.idx;
		for (var i = 0; i < ix.length; i += 3) {
			var t = ix[i + 1];
			ix[i + 1] = ix[i + 2];
			ix[i + 2] = t;
		}
		return this;
	};
	Mesh.prototype.translate = function (x, y, z) {
		return this.transform(mTranslate(x || 0, y || 0, z || 0));
	};
	Mesh.prototype.scale = function (x, y, z) {
		if (y == null && z == null) {
			y = x;
			z = x;
		}
		return this.transform(mScale(x, y, z));
	};
	Mesh.prototype.rotateX = function (d) {
		return this.transform(mRotAxis([1, 0, 0], d));
	};
	Mesh.prototype.rotateY = function (d) {
		return this.transform(mRotAxis([0, 1, 0], d));
	};
	Mesh.prototype.rotateZ = function (d) {
		return this.transform(mRotAxis([0, 0, 1], d));
	};
	Mesh.prototype.rotate = function (axis, d) {
		return this.transform(mRotAxis(axis, d));
	};
	Mesh.prototype.bbox = function () {
		var p = this.pos;
		if (!p.length) return { min: [0, 0, 0], max: [0, 0, 0] };
		var mn = [1 / 0, 1 / 0, 1 / 0],
			mx = [-1 / 0, -1 / 0, -1 / 0];
		for (var i = 0; i < p.length; i += 3)
			for (var k = 0; k < 3; k++) {
				var v = p[i + k];
				if (v < mn[k]) mn[k] = v;
				if (v > mx[k]) mx[k] = v;
			}
		return { min: mn, max: mx };
	};
	Mesh.prototype.dims = function () {
		var b = this.bbox();
		return vsub(b.max, b.min);
	};
	Mesh.prototype.center = function (axes) {
		axes = axes || 'xyz';
		var b = this.bbox();
		var c = vmul(vadd(b.min, b.max), 0.5);
		return this.translate(
			axes.indexOf('x') >= 0 ? -c[0] : 0,
			axes.indexOf('y') >= 0 ? -c[1] : 0,
			axes.indexOf('z') >= 0 ? -c[2] : 0,
		);
	};
	Mesh.prototype.alignBottom = function (y) {
		var b = this.bbox();
		return this.translate(0, (y || 0) - b.min[1], 0);
	};
	Mesh.prototype.merge = function (other) {
		var base = this.vertCount();
		this.pos = this.pos.concat(other.pos);
		if (this.nrm && other.nrm) this.nrm = this.nrm.concat(other.nrm);
		else if (this.nrm || other.nrm) {
			this.computeNormals();
			var o2 = other.clone();
			if (!o2.nrm) o2.computeNormals();
			this.nrm = this.nrm.slice(0, base * 3).concat(o2.nrm);
		}
		if (this.uv && other.uv) this.uv = this.uv.concat(other.uv);
		else if (this.uv || other.uv) {
			var mu = this.uv ? this.uv.slice() : new Array(base * 2).fill(0);
			var ou = other.uv ? other.uv : new Array(other.vertCount() * 2).fill(0);
			this.uv = mu.concat(ou);
		}
		for (var i = 0; i < other.idx.length; i++) this.idx.push(other.idx[i] + base);
		return this;
	};
	Mesh.prototype.computeNormals = function (opt) {
		var mode = (opt && opt.mode) || (typeof opt === 'string' ? opt : null) || 'angle';
		var angle = opt && isNum(opt.angleDeg) ? opt.angleDeg : 60;
		var p = this.pos,
			ix = this.idx,
			vc = this.vertCount();
		var fn = [];
		for (var f = 0; f < ix.length; f += 3) {
			var a = ix[f] * 3,
				b = ix[f + 1] * 3,
				c = ix[f + 2] * 3;
			var e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]],
				e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
			fn.push(vcross(e1, e2));
		}
		if (mode === 'flat') {
			var np = [],
				nn = [],
				nu = [],
				ni = [];
			for (var f2 = 0; f2 < ix.length; f2 += 3) {
				var n2 = vnorm(fn[f2 / 3]);
				for (var k = 0; k < 3; k++) {
					var vi = ix[f2 + k];
					np.push(p[vi * 3], p[vi * 3 + 1], p[vi * 3 + 2]);
					nn.push(n2[0], n2[1], n2[2]);
					if (this.uv) nu.push(this.uv[vi * 2], this.uv[vi * 2 + 1]);
					ni.push(f2 + k);
				}
			}
			this.pos = np;
			this.nrm = nn;
			this.uv = this.uv ? nu : null;
			this.idx = ni;
			return this;
		}
		if (mode === 'smooth') {
			var acc = new Array(vc * 3).fill(0);
			for (var f3 = 0; f3 < ix.length; f3 += 3) {
				var nf = fn[f3 / 3];
				for (var k3 = 0; k3 < 3; k3++) {
					var v3i = ix[f3 + k3] * 3;
					acc[v3i] += nf[0];
					acc[v3i + 1] += nf[1];
					acc[v3i + 2] += nf[2];
				}
			}
			this.nrm = [];
			for (var v = 0; v < vc; v++) {
				var nv = vnorm([acc[v * 3], acc[v * 3 + 1], acc[v * 3 + 2]]);
				this.nrm.push(nv[0], nv[1], nv[2]);
			}
			return this;
		}
		var cosLim = Math.cos(angle * DEG);
		var vfaces = new Array(vc);
		for (var vv = 0; vv < vc; vv++) vfaces[vv] = [];
		for (var f4 = 0; f4 < ix.length; f4 += 3) {
			vfaces[ix[f4]].push(f4 / 3);
			vfaces[ix[f4 + 1]].push(f4 / 3);
			vfaces[ix[f4 + 2]].push(f4 / 3);
		}
		var np2 = [],
			nn2 = [],
			nu2 = [],
			map = new Map(),
			ni2 = new Array(ix.length);
		for (var f5 = 0; f5 < ix.length; f5 += 3) {
			var fi = f5 / 3;
			var nfn = vnorm(fn[fi]);
			for (var k5 = 0; k5 < 3; k5++) {
				var ov = ix[f5 + k5];
				var acc2 = [0, 0, 0],
					flist = vfaces[ov];
				for (var q = 0; q < flist.length; q++) {
					var g = flist[q],
						gn = vnorm(fn[g]);
					if (vdot(gn, nfn) >= cosLim) {
						var raw = fn[g];
						acc2[0] += raw[0];
						acc2[1] += raw[1];
						acc2[2] += raw[2];
					}
				}
				var sn = vnorm(acc2);
				if (vlen(sn) < 0.5) sn = nfn;
				var key =
					ov +
					':' +
					Math.round(sn[0] * 500) +
					':' +
					Math.round(sn[1] * 500) +
					':' +
					Math.round(sn[2] * 500);
				var got = map.get(key);
				if (got == null) {
					got = np2.length / 3;
					map.set(key, got);
					np2.push(p[ov * 3], p[ov * 3 + 1], p[ov * 3 + 2]);
					nn2.push(sn[0], sn[1], sn[2]);
					if (this.uv) nu2.push(this.uv[ov * 2], this.uv[ov * 2 + 1]);
				}
				ni2[f5 + k5] = got;
			}
		}
		this.pos = np2;
		this.nrm = nn2;
		this.uv = this.uv ? nu2 : null;
		this.idx = ni2;
		return this;
	};
	Mesh.prototype.flipNormals = function () {
		if (this.nrm) for (var i = 0; i < this.nrm.length; i++) this.nrm[i] = -this.nrm[i];
		return this.flipWinding();
	};
	Mesh.prototype.weld = function (opt) {
		var eps = (opt && opt.eps) || 1e-4;
		var useUv = !(opt && opt.ignoreUv) && !!this.uv;
		var inv = 1 / eps;
		var map = new Map(),
			remap = new Array(this.vertCount()),
			np = [],
			nn = [],
			nu = [];
		for (var v = 0; v < this.vertCount(); v++) {
			var key =
				Math.round(this.pos[v * 3] * inv) +
				':' +
				Math.round(this.pos[v * 3 + 1] * inv) +
				':' +
				Math.round(this.pos[v * 3 + 2] * inv);
			if (useUv)
				key +=
					':' + Math.round(this.uv[v * 2] * 1024) + ':' + Math.round(this.uv[v * 2 + 1] * 1024);
			var got = map.get(key);
			if (got == null) {
				got = np.length / 3;
				map.set(key, got);
				np.push(this.pos[v * 3], this.pos[v * 3 + 1], this.pos[v * 3 + 2]);
				if (this.nrm) nn.push(this.nrm[v * 3], this.nrm[v * 3 + 1], this.nrm[v * 3 + 2]);
				if (this.uv) nu.push(this.uv[v * 2], this.uv[v * 2 + 1]);
			}
			remap[v] = got;
		}
		var ni = [];
		for (var i = 0; i < this.idx.length; i += 3) {
			var a = remap[this.idx[i]],
				b = remap[this.idx[i + 1]],
				c = remap[this.idx[i + 2]];
			if (a !== b && b !== c && a !== c) ni.push(a, b, c);
		}
		this.pos = np;
		this.nrm = this.nrm ? nn : null;
		this.uv = this.uv ? nu : null;
		this.idx = ni;
		return this;
	};

	function gridPatch(m, nx, ny, fnPos, fnUv) {
		var base = m.vertCount();
		for (var j = 0; j <= ny; j++)
			for (var i = 0; i <= nx; i++) {
				var u = i / nx,
					v = j / ny;
				var p = fnPos(u, v);
				m.pos.push(p[0], p[1], p[2]);
				var t = fnUv ? fnUv(u, v) : [u, v];
				m.__uvtmp.push(t[0], t[1]);
			}
		for (var j2 = 0; j2 < ny; j2++)
			for (var i2 = 0; i2 < nx; i2++) {
				var a = base + j2 * (nx + 1) + i2,
					b = a + 1,
					c = a + (nx + 1),
					d = c + 1;
				m.idx.push(a, b, c, b, d, c);
			}
	}
	function startMesh(name) {
		var m = new Mesh(name);
		m.__uvtmp = [];
		return m;
	}
	function endMesh(m, normalOpt) {
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		m.computeNormals(normalOpt || { angleDeg: 60 });
		return m;
	}
	function box(opt) {
		opt = opt || {};
		var w = isNum(opt.w) ? opt.w : 1,
			h = isNum(opt.h) ? opt.h : 1,
			d = isNum(opt.d) ? opt.d : 1;
		var sx = Math.max(1, opt.sx | 0 || 1),
			sy = Math.max(1, opt.sy | 0 || 1),
			sz = Math.max(1, opt.sz | 0 || 1);
		var m = startMesh(opt.name || 'box'),
			hw = w / 2,
			hh = h / 2,
			hd = d / 2;
		gridPatch(m, sx, sy, function (u, v) {
			return [lerp(-hw, hw, u), lerp(-hh, hh, v), hd];
		});
		gridPatch(m, sx, sy, function (u, v) {
			return [lerp(hw, -hw, u), lerp(-hh, hh, v), -hd];
		});
		gridPatch(m, sz, sy, function (u, v) {
			return [hw, lerp(-hh, hh, v), lerp(hd, -hd, u)];
		});
		gridPatch(m, sz, sy, function (u, v) {
			return [-hw, lerp(-hh, hh, v), lerp(-hd, hd, u)];
		});
		gridPatch(m, sx, sz, function (u, v) {
			return [lerp(-hw, hw, u), hh, lerp(hd, -hd, v)];
		});
		gridPatch(m, sx, sz, function (u, v) {
			return [lerp(-hw, hw, u), -hh, lerp(-hd, hd, v)];
		});
		return endMesh(m, { angleDeg: 10 });
	}
	function plane(opt) {
		opt = opt || {};
		var w = isNum(opt.w) ? opt.w : 1,
			d = isNum(opt.d) ? opt.d : 1,
			sx = Math.max(1, opt.sx | 0 || 1),
			sz = Math.max(1, opt.sz | 0 || 1);
		var m = startMesh(opt.name || 'plane');
		gridPatch(m, sx, sz, function (u, v) {
			return [lerp(-w / 2, w / 2, u), 0, lerp(d / 2, -d / 2, v)];
		});
		return endMesh(m, 'smooth');
	}
	function sphere(opt) {
		opt = opt || {};
		var r = isNum(opt.r) ? opt.r : 0.5,
			seg = Math.max(3, opt.seg | 0 || 24),
			rings = Math.max(2, opt.rings | 0 || Math.max(3, Math.round(seg / 2)));
		var m = startMesh(opt.name || 'sphere');
		gridPatch(m, seg, rings, function (u, v) {
			var th = u * Math.PI * 2,
				ph = (v - 0.5) * Math.PI;
			return [Math.cos(ph) * Math.cos(th) * r, Math.sin(ph) * r, -Math.cos(ph) * Math.sin(th) * r];
		});
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		m.weld({ eps: 1e-6, ignoreUv: false });
		stripDegenerate(m);
		m.computeNormals('smooth');
		return m;
	}
	function icosphere(opt) {
		opt = opt || {};
		var r = isNum(opt.r) ? opt.r : 0.5,
			sub = clamp(opt.sub | 0 || 2, 0, 5);
		var t = (1 + Math.sqrt(5)) / 2;
		var P = [
			[-1, t, 0],
			[1, t, 0],
			[-1, -t, 0],
			[1, -t, 0],
			[0, -1, t],
			[0, 1, t],
			[0, -1, -t],
			[0, 1, -t],
			[t, 0, -1],
			[t, 0, 1],
			[-t, 0, -1],
			[-t, 0, 1],
		].map(vnorm);
		var I = [
			0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1,
			8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
		];
		for (var s = 0; s < sub; s++) {
			var NI = [],
				cache = new Map();
			function mid(a, b) {
				var k = a < b ? a + '_' + b : b + '_' + a;
				var g = cache.get(k);
				if (g != null) return g;
				var p = vnorm(vlerp(P[a], P[b], 0.5));
				P.push(p);
				g = P.length - 1;
				cache.set(k, g);
				return g;
			}
			for (var f = 0; f < I.length; f += 3) {
				var a = I[f],
					b = I[f + 1],
					c = I[f + 2],
					ab = mid(a, b),
					bc = mid(b, c),
					ca = mid(c, a);
				NI.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
			}
			I = NI;
		}
		var m = new Mesh(opt.name || 'icosphere');
		for (var v = 0; v < P.length; v++) {
			m.pos.push(P[v][0] * r, P[v][1] * r, P[v][2] * r);
		}
		m.idx = I;
		m.uv = [];
		for (var v2 = 0; v2 < P.length; v2++) {
			var p2 = P[v2];
			m.uv.push(
				0.5 + Math.atan2(-p2[2], p2[0]) / (2 * Math.PI),
				0.5 + Math.asin(clamp(p2[1], -1, 1)) / Math.PI,
			);
		}
		m.computeNormals('smooth');
		return m;
	}
	function cylinder(opt) {
		opt = opt || {};
		var r1 = isNum(opt.r1) ? opt.r1 : isNum(opt.r) ? opt.r : 0.5,
			r2 = isNum(opt.r2) ? opt.r2 : isNum(opt.r) ? opt.r : 0.5;
		var h = isNum(opt.h) ? opt.h : 1,
			seg = Math.max(3, opt.seg | 0 || 24),
			hseg = Math.max(1, opt.hseg | 0 || 1),
			caps = opt.caps !== false;
		var m = startMesh(opt.name || 'cylinder');
		gridPatch(m, seg, hseg, function (u, v) {
			var th = u * Math.PI * 2,
				rr = lerp(r1, r2, v);
			return [Math.cos(th) * rr, (v - 0.5) * h, -Math.sin(th) * rr];
		});
		if (caps) {
			if (r1 > 1e-9) discInto(m, r1, seg, -h / 2, true);
			if (r2 > 1e-9) discInto(m, r2, seg, h / 2, false);
		}
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		m.weld({ eps: 1e-6 });
		m.computeNormals({ angleDeg: 46 });
		return m;
	}
	function discInto(m, r, seg, y, flip) {
		var base = m.vertCount();
		m.pos.push(0, y, 0);
		m.__uvtmp.push(0.5, 0.5);
		for (var i = 0; i <= seg; i++) {
			var th = (i / seg) * Math.PI * 2;
			m.pos.push(Math.cos(th) * r, y, -Math.sin(th) * r);
			m.__uvtmp.push(0.5 + Math.cos(th) * 0.5, 0.5 + Math.sin(th) * 0.5);
		}
		for (var i2 = 0; i2 < seg; i2++) {
			var a = base + 1 + i2,
				b = base + 1 + i2 + 1;
			if (flip) m.idx.push(base, b, a);
			else m.idx.push(base, a, b);
		}
	}
	function cone(opt) {
		opt = opt || {};
		opt.r1 = isNum(opt.r) ? opt.r : isNum(opt.r1) ? opt.r1 : 0.5;
		opt.r2 = 0;
		if (!opt.name) opt.name = 'cone';
		delete opt.r;
		return cylinder(opt);
	}
	function capsule(opt) {
		opt = opt || {};
		var r = isNum(opt.r) ? opt.r : 0.25,
			h = Math.max(0, (isNum(opt.h) ? opt.h : 1) - 2 * r),
			seg = Math.max(8, opt.seg | 0 || 24),
			rings = Math.max(2, opt.rings | 0 || 8);
		var m = startMesh(opt.name || 'capsule');
		gridPatch(m, seg, rings, function (u, v) {
			var th = u * Math.PI * 2,
				ph = ((v - 1) * Math.PI) / 2;
			return [
				Math.cos(ph) * Math.cos(th) * r,
				-h / 2 + Math.sin(ph) * r,
				-Math.cos(ph) * Math.sin(th) * r,
			];
		});
		if (h > 1e-9)
			gridPatch(m, seg, 1, function (u, v) {
				var th = u * Math.PI * 2;
				return [Math.cos(th) * r, lerp(-h / 2, h / 2, v), -Math.sin(th) * r];
			});
		gridPatch(m, seg, rings, function (u, v) {
			var th = u * Math.PI * 2,
				ph = (v * Math.PI) / 2;
			return [
				Math.cos(ph) * Math.cos(th) * r,
				h / 2 + Math.sin(ph) * r,
				-Math.cos(ph) * Math.sin(th) * r,
			];
		});
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		m.weld({ eps: 1e-6, ignoreUv: true });
		stripDegenerate(m);
		m.computeNormals('smooth');
		return m;
	}
	function torus(opt) {
		opt = opt || {};
		var R = isNum(opt.R) ? opt.R : 0.5,
			r = isNum(opt.r) ? opt.r : 0.15,
			seg = Math.max(3, opt.seg | 0 || 32),
			rseg = Math.max(3, opt.rseg | 0 || 16),
			arc = isNum(opt.arcDeg) ? opt.arcDeg * DEG : Math.PI * 2;
		var m = startMesh(opt.name || 'torus');
		gridPatch(m, seg, rseg, function (u, v) {
			var th = u * arc,
				ph = v * Math.PI * 2;
			var cx = Math.cos(th) * R,
				cz = -Math.sin(th) * R;
			var rr = R + Math.cos(ph) * r;
			return [Math.cos(th) * rr, Math.sin(ph) * r, -Math.sin(th) * rr];
		});
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		if (arc >= Math.PI * 2 - 1e-6) m.weld({ eps: 1e-6, ignoreUv: true });
		m.computeNormals('smooth');
		return m;
	}
	function disc(opt) {
		opt = opt || {};
		var r = isNum(opt.r) ? opt.r : 0.5,
			inner = isNum(opt.inner) ? opt.inner : 0,
			seg = Math.max(3, opt.seg | 0 || 32);
		var m = startMesh(opt.name || 'disc');
		if (inner > 1e-9) {
			gridPatch(m, seg, 1, function (u, v) {
				var th = u * Math.PI * 2,
					rr = lerp(inner, r, v);
				return [Math.cos(th) * rr, 0, -Math.sin(th) * rr];
			});
		} else discInto(m, r, seg, 0, false);
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		m.computeNormals('smooth');
		return m;
	}
	function prism(opt) {
		opt = opt || {};
		opt.seg = Math.max(3, opt.sides | 0 || 6);
		if (!opt.name) opt.name = 'prism';
		var m = cylinder(opt);
		return m.computeNormals({ angleDeg: 10 });
	}
	function roundedBox(opt) {
		opt = opt || {};
		var w = isNum(opt.w) ? opt.w : 1,
			h = isNum(opt.h) ? opt.h : 1,
			d = isNum(opt.d) ? opt.d : 1;
		var r = clamp(
				isNum(opt.r) ? opt.r : Math.min(w, h, d) * 0.1,
				0.0001,
				Math.min(w, h, d) / 2 - 1e-6,
			),
			seg = Math.max(2, opt.seg | 0 || 4);
		var m = box({
			w: w,
			h: h,
			d: d,
			sx: seg * 2,
			sy: seg * 2,
			sz: seg * 2,
			name: opt.name || 'roundedBox',
		});
		var hw = w / 2 - r,
			hh = h / 2 - r,
			hd = d / 2 - r,
			p = m.pos;
		for (var i = 0; i < p.length; i += 3) {
			var cx = clamp(p[i], -hw, hw),
				cy = clamp(p[i + 1], -hh, hh),
				cz = clamp(p[i + 2], -hd, hd);
			var dx = p[i] - cx,
				dy = p[i + 1] - cy,
				dz = p[i + 2] - cz,
				l = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (l > 1e-12) {
				p[i] = cx + (dx / l) * r;
				p[i + 1] = cy + (dy / l) * r;
				p[i + 2] = cz + (dz / l) * r;
			}
		}
		m.weld({ eps: 1e-6, ignoreUv: true });
		return m.computeNormals({ angleDeg: 61 });
	}

	function Shape() {
		this.pts = [];
		this.holes = [];
		this.__pen = [0, 0];
	}
	Shape.prototype.moveTo = function (x, y) {
		this.__pen = [x, y];
		if (!this.pts.length) this.pts.push([x, y]);
		return this;
	};
	Shape.prototype.lineTo = function (x, y) {
		this.pts.push([x, y]);
		this.__pen = [x, y];
		return this;
	};
	Shape.prototype.quadTo = function (cx, cy, x, y, seg) {
		seg = seg || 8;
		var p0 = this.__pen;
		for (var i = 1; i <= seg; i++) {
			var t = i / seg,
				a = lerp(p0[0], cx, t),
				b = lerp(p0[1], cy, t),
				c = lerp(cx, x, t),
				d = lerp(cy, y, t);
			this.pts.push([lerp(a, c, t), lerp(b, d, t)]);
		}
		this.__pen = [x, y];
		return this;
	};
	Shape.prototype.bezierTo = function (c1x, c1y, c2x, c2y, x, y, seg) {
		seg = seg || 10;
		var p0 = this.__pen;
		for (var i = 1; i <= seg; i++) {
			var t = i / seg,
				mt = 1 - t;
			this.pts.push([
				mt * mt * mt * p0[0] + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * x,
				mt * mt * mt * p0[1] + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * y,
			]);
		}
		this.__pen = [x, y];
		return this;
	};
	Shape.prototype.arcTo = function (cx, cy, r, a0deg, a1deg, seg) {
		seg = seg || 12;
		for (var i = 0; i <= seg; i++) {
			var a = lerp(a0deg, a1deg, i / seg) * DEG;
			var pt = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
			if (
				i === 0 &&
				this.pts.length &&
				Math.abs(this.pts[this.pts.length - 1][0] - pt[0]) < 1e-12 &&
				Math.abs(this.pts[this.pts.length - 1][1] - pt[1]) < 1e-12
			)
				continue;
			this.pts.push(pt);
		}
		this.__pen = this.pts[this.pts.length - 1].slice();
		return this;
	};
	Shape.prototype.close = function () {
		return this;
	};
	Shape.prototype.addHole = function (shapeOrPts) {
		this.holes.push(shapeOrPts.pts ? shapeOrPts.pts : shapeOrPts);
		return this;
	};
	function shapeArea(pts) {
		var s = 0;
		for (var i = 0; i < pts.length; i++) {
			var a = pts[i],
				b = pts[(i + 1) % pts.length];
			s += a[0] * b[1] - b[0] * a[1];
		}
		return s / 2;
	}
	function circleShape(r, seg) {
		var s = new Shape();
		seg = seg || 32;
		for (var i = 0; i < seg; i++) {
			var a = (i / seg) * Math.PI * 2;
			s.pts.push([Math.cos(a) * r, Math.sin(a) * r]);
		}
		return s;
	}
	function rectShape(w, h, r, seg) {
		var s = new Shape();
		if (!r || r <= 0) {
			s.pts = [
				[-w / 2, -h / 2],
				[w / 2, -h / 2],
				[w / 2, h / 2],
				[-w / 2, h / 2],
			];
			return s;
		}
		r = Math.min(r, w / 2 - 1e-9, h / 2 - 1e-9);
		seg = seg || 6;
		s.moveTo(-w / 2 + r, -h / 2);
		s.lineTo(w / 2 - r, -h / 2);
		s.arcTo(w / 2 - r, -h / 2 + r, r, -90, 0, seg);
		s.lineTo(w / 2, h / 2 - r);
		s.arcTo(w / 2 - r, h / 2 - r, r, 0, 90, seg);
		s.lineTo(-w / 2 + r, h / 2);
		s.arcTo(-w / 2 + r, h / 2 - r, r, 90, 180, seg);
		s.lineTo(-w / 2, -h / 2 + r);
		s.arcTo(-w / 2 + r, -h / 2 + r, r, 180, 270, seg);
		return s;
	}
	function polyShape(points) {
		var s = new Shape();
		s.pts = points.map(function (p) {
			return [p[0], p[1]];
		});
		return s;
	}
	function starShape(n, r1, r2) {
		var s = new Shape();
		n = n || 5;
		for (var i = 0; i < n * 2; i++) {
			var a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2,
				r = i % 2 === 0 ? r1 : r2;
			s.pts.push([Math.cos(a) * r, Math.sin(a) * r]);
		}
		return s;
	}
	function gearShape(teeth, rOut, rIn, toothFrac) {
		teeth = teeth || 8;
		toothFrac = toothFrac || 0.4;
		var s = new Shape(),
			N = teeth * 4;
		for (var i = 0; i < N; i++) {
			var seg = i % 4,
				base = (Math.floor(i / 4) / teeth) * Math.PI * 2,
				step = (1 / teeth) * Math.PI * 2;
			var a =
				base +
				(seg === 0
					? 0
					: seg === 1
						? step * toothFrac * 0.5
						: seg === 2
							? step * (0.5 + toothFrac * 0.25)
							: step * 0.75);
			var r = seg === 1 || seg === 2 ? rOut : rIn;
			s.pts.push([Math.cos(a) * r, Math.sin(a) * r]);
		}
		return s;
	}
	function triangulateShape(shape) {
		var outer = shape.pts.map(function (p) {
			return p.slice();
		});
		if (shapeArea(outer) < 0) outer.reverse();
		var holes = (shape.holes || []).map(function (hp) {
			var h = hp.map(function (p) {
				return p.slice();
			});
			if (shapeArea(h) > 0) h.reverse();
			return h;
		});
		holes.sort(function (a, b) {
			var mx = function (pts) {
				return Math.max.apply(
					null,
					pts.map(function (p) {
						return p[0];
					}),
				);
			};
			return mx(b) - mx(a);
		});
		for (var hI = 0; hI < holes.length; hI++) {
			outer = bridgeHole(outer, holes[hI]);
		}
		var n = outer.length,
			V = [],
			i;
		for (i = 0; i < n; i++) V.push(i);
		var tris = [],
			guard = 0;
		function area2(a, b, c) {
			return (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
		}
		function inTri(p, a, b, c) {
			var s1 = area2(a, b, p),
				s2 = area2(b, c, p),
				s3 = area2(c, a, p);
			return s1 >= -1e-12 && s2 >= -1e-12 && s3 >= -1e-12;
		}
		while (V.length > 3 && guard < 20000) {
			guard++;
			var clipped = false;
			for (i = 0; i < V.length; i++) {
				var i0 = V[(i + V.length - 1) % V.length],
					i1 = V[i],
					i2 = V[(i + 1) % V.length];
				var a = outer[i0],
					b = outer[i1],
					c = outer[i2];
				if (area2(a, b, c) <= 1e-14) continue;
				var ok = true;
				for (var j = 0; j < V.length; j++) {
					var vj = V[j];
					if (vj === i0 || vj === i1 || vj === i2) continue;
					if (inTri(outer[vj], a, b, c)) {
						ok = false;
						break;
					}
				}
				if (ok) {
					tris.push(i0, i1, i2);
					V.splice(i, 1);
					clipped = true;
					break;
				}
			}
			if (!clipped) {
				V.splice(0, 1);
			}
		}
		if (V.length === 3) tris.push(V[0], V[1], V[2]);
		return { points: outer, tris: tris };
	}
	function bridgeHole(outer, hole) {
		var hi = 0;
		for (var i = 1; i < hole.length; i++) if (hole[i][0] > hole[hi][0]) hi = i;
		var hp = hole[hi],
			oi = 0,
			best = 1 / 0;
		for (var j = 0; j < outer.length; j++) {
			var op = outer[j];
			if (op[0] < hp[0] - 1e-12) continue;
			var d = (op[0] - hp[0]) * (op[0] - hp[0]) + (op[1] - hp[1]) * (op[1] - hp[1]);
			if (d < best) {
				best = d;
				oi = j;
			}
		}
		var out = [];
		for (var k = 0; k <= oi; k++) out.push(outer[k].slice());
		for (var m = 0; m <= hole.length; m++) out.push(hole[(hi + m) % hole.length].slice());
		out.push(outer[oi].slice());
		for (var q = oi + 1; q < outer.length; q++) out.push(outer[q].slice());
		return out;
	}

	function stripDegenerate(m) {
		var p = m.pos,
			keep = [],
			ix = m.idx;
		for (var f = 0; f < ix.length; f += 3) {
			var a = ix[f] * 3,
				b = ix[f + 1] * 3,
				c = ix[f + 2] * 3;
			var ux = p[b] - p[a],
				uy = p[b + 1] - p[a + 1],
				uz = p[b + 2] - p[a + 2],
				vx = p[c] - p[a],
				vy = p[c + 1] - p[a + 1],
				vz = p[c + 2] - p[a + 2];
			var cx = uy * vz - uz * vy,
				cy = uz * vx - ux * vz,
				cz = ux * vy - uy * vx;
			if (cx * cx + cy * cy + cz * cz > 1e-24) keep.push(ix[f], ix[f + 1], ix[f + 2]);
		}
		m.idx = keep;
		return m;
	}
	function lathe(profile, opt) {
		opt = opt || {};
		if (!profile || profile.length < 2)
			throw new Error('lathe: perfil precisa de 2+ pontos [raio,altura], da base para o topo');
		var seg = Math.max(3, opt.seg | 0 || 32),
			ang = (isNum(opt.angleDeg) ? opt.angleDeg : 360) * DEG;
		var full = Math.abs(ang - Math.PI * 2) < 1e-6;
		var m = startMesh(opt.name || 'lathe');
		var dist = [0];
		for (var i = 1; i < profile.length; i++)
			dist.push(
				dist[i - 1] +
					Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]),
			);
		var total = dist[dist.length - 1] || 1,
			rows = profile.length - 1;
		gridPatch(
			m,
			seg,
			rows,
			function (u, v) {
				var pi = Math.round(v * rows),
					p = profile[pi],
					th = u * ang;
				return [Math.cos(th) * p[0], p[1], -Math.sin(th) * p[0]];
			},
			function (u, v) {
				var pi = Math.round(v * rows);
				return [u, dist[pi] / total];
			},
		);
		if (opt.caps !== false && full) {
			var p0 = profile[0],
				pN = profile[profile.length - 1];
			if (p0[0] > 1e-9) discInto(m, p0[0], seg, p0[1], true);
			if (pN[0] > 1e-9) discInto(m, pN[0], seg, pN[1], false);
		}
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		stripDegenerate(m);
		m.weld({ eps: 1e-9, ignoreUv: false });
		m.computeNormals({ angleDeg: isNum(opt.smoothDeg) ? opt.smoothDeg : 46 });
		return m;
	}
	function rotVec(v, axis, ang) {
		var c = Math.cos(ang),
			s = Math.sin(ang);
		return vadd(vadd(vmul(v, c), vmul(vcross(axis, v), s)), vmul(axis, vdot(axis, v) * (1 - c)));
	}
	function frameAlong(path, closed) {
		var n = path.length,
			tans = [];
		for (var i = 0; i < n; i++) {
			var a = closed ? path[(i - 1 + n) % n] : path[Math.max(0, i - 1)],
				b = closed ? path[(i + 1) % n] : path[Math.min(n - 1, i + 1)];
			var t = vsub(b, a),
				l = vlen(t);
			tans.push(
				l > 1e-12 ? vmul(t, 1 / l) : tans.length ? tans[tans.length - 1].slice() : [0, 1, 0],
			);
		}
		var up = Math.abs(tans[0][1]) > 0.93 ? [0, 0, 1] : [0, 1, 0];
		var c0 = vcross(tans[0], up);
		if (vlen(c0) < 1e-6) {
			up = [1, 0, 0];
			c0 = vcross(tans[0], up);
		}
		var bin = vnorm(c0),
			nor = vnorm(vcross(bin, tans[0]));
		var frames = [{ p: path[0], t: tans[0], n: nor, b: bin }];
		for (var j = 1; j < n; j++) {
			var ax = vcross(tans[j - 1], tans[j]),
				al = vlen(ax);
			if (al > 1e-9) {
				ax = vmul(ax, 1 / al);
				var ang = Math.acos(clamp(vdot(tans[j - 1], tans[j]), -1, 1));
				nor = rotVec(nor, ax, ang);
			}
			bin = vnorm(vcross(tans[j], nor));
			nor = vnorm(vcross(bin, tans[j]));
			frames.push({ p: path[j], t: tans[j], n: nor, b: bin });
		}
		return frames;
	}
	function capRing(m, frame, pts, opt, tv, flip) {
		var tri = triangulateShape({ pts: pts, holes: [] });
		var base = m.vertCount();
		var sc = opt.scaleFn ? opt.scaleFn(tv) : 1,
			sx = Array.isArray(sc) ? sc[0] : sc,
			sy = Array.isArray(sc) ? sc[1] : sc;
		var tw = opt.twistFn ? opt.twistFn(tv) * DEG : 0,
			c = Math.cos(tw),
			s = Math.sin(tw);
		var mnx = 1 / 0,
			mny = 1 / 0,
			mxx = -1 / 0,
			mxy = -1 / 0,
			q,
			p;
		for (q = 0; q < tri.points.length; q++) {
			p = tri.points[q];
			if (p[0] < mnx) mnx = p[0];
			if (p[0] > mxx) mxx = p[0];
			if (p[1] < mny) mny = p[1];
			if (p[1] > mxy) mxy = p[1];
		}
		var w = mxx - mnx || 1,
			h = mxy - mny || 1;
		for (q = 0; q < tri.points.length; q++) {
			p = tri.points[q];
			var x = p[0] * sx,
				y = p[1] * sy,
				x2 = x * c - y * s,
				y2 = x * s + y * c;
			var P = vadd(frame.p, vadd(vmul(frame.n, x2), vmul(frame.b, y2)));
			m.pos.push(P[0], P[1], P[2]);
			m.uv.push((p[0] - mnx) / w, (p[1] - mny) / h);
		}
		for (var f = 0; f < tri.tris.length; f += 3) {
			if (flip) m.idx.push(base + tri.tris[f], base + tri.tris[f + 2], base + tri.tris[f + 1]);
			else m.idx.push(base + tri.tris[f], base + tri.tris[f + 1], base + tri.tris[f + 2]);
		}
	}
	function sweep(profile, path, opt) {
		opt = opt || {};
		var pts = profile && profile.pts ? profile.pts : profile;
		if (!pts || pts.length < 3)
			throw new Error('sweep: perfil 2D precisa de 3+ pontos (use F.circleShape(r) ou F.shape())');
		if (!path || path.length < 2)
			throw new Error('sweep: caminho precisa de 2+ pontos [x,y,z] (use F.path.*)');
		if (shapeArea(pts) < 0) pts = pts.slice().reverse();
		var n = path.length;
		var loop = vlen(vsub(path[0], path[n - 1])) < 1e-9;
		var frames = frameAlong(path, loop);
		var dist = [0];
		for (var i = 1; i < n; i++) dist.push(dist[i - 1] + vlen(vsub(path[i], path[i - 1])));
		var total = dist[n - 1] || 1,
			rows = n - 1,
			segN = pts.length;
		var m = startMesh(opt.name || 'sweep');
		gridPatch(
			m,
			segN,
			rows,
			function (u, v) {
				var ri = Math.round(u * segN) % segN,
					pi = Math.round(v * rows);
				var f = frames[pi],
					pt = pts[ri],
					t = rows ? pi / rows : 0;
				var sc = opt.scaleFn ? opt.scaleFn(t) : 1,
					sx = Array.isArray(sc) ? sc[0] : sc,
					sy = Array.isArray(sc) ? sc[1] : sc;
				var x = pt[0] * sx,
					y = pt[1] * sy;
				if (opt.twistFn) {
					var tw = opt.twistFn(t) * DEG,
						c = Math.cos(tw),
						s = Math.sin(tw),
						x2 = x * c - y * s;
					y = x * s + y * c;
					x = x2;
				}
				return vadd(f.p, vadd(vmul(f.n, x), vmul(f.b, y)));
			},
			function (u, v) {
				var pi = Math.round(v * rows);
				return [u, dist[pi] / total];
			},
		);
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		if (opt.caps !== false && !loop) {
			capRing(m, frames[0], pts, opt, 0, true);
			capRing(m, frames[n - 1], pts, opt, 1, false);
		}
		stripDegenerate(m);
		m.weld({ eps: 1e-9, ignoreUv: false });
		m.computeNormals({ angleDeg: isNum(opt.smoothDeg) ? opt.smoothDeg : 46 });
		return m;
	}
	function offsetPts(pts, ins) {
		var n = pts.length,
			out = [];
		for (var i = 0; i < n; i++) {
			var p0 = pts[(i - 1 + n) % n],
				p1 = pts[i],
				p2 = pts[(i + 1) % n];
			var d1x = p1[0] - p0[0],
				d1y = p1[1] - p0[1],
				d2x = p2[0] - p1[0],
				d2y = p2[1] - p1[1];
			var l1 = Math.hypot(d1x, d1y) || 1,
				l2 = Math.hypot(d2x, d2y) || 1;
			var n1x = d1y / l1,
				n1y = -d1x / l1,
				n2x = d2y / l2,
				n2y = -d2x / l2;
			var nx = n1x + n2x,
				ny = n1y + n2y,
				nl = Math.hypot(nx, ny);
			if (nl < 1e-9) {
				out.push([p1[0], p1[1]]);
				continue;
			}
			nx /= nl;
			ny /= nl;
			var dv = clamp(n1x * nx + n1y * ny, 0.2, 1);
			out.push([p1[0] - (nx * ins) / dv, p1[1] - (ny * ins) / dv]);
		}
		return out;
	}
	function extrude(shape, opt) {
		opt = opt || {};
		if (opt.path) return sweep(shape, opt.path, opt);
		var src = shape && shape.pts ? shape.pts : shape;
		if (!src || src.length < 3)
			throw new Error('extrude: forma precisa de 3+ pontos (use F.shape(), F.polyShape(...))');
		var pts = src.map(function (p) {
			return [p[0], p[1]];
		});
		if (shapeArea(pts) < 0) pts.reverse();
		var holes = ((shape && shape.holes) || []).map(function (h) {
			var hp = (h.pts ? h.pts : h).map(function (p) {
				return [p[0], p[1]];
			});
			if (shapeArea(hp) > 0) hp.reverse();
			return hp;
		});
		var d = isNum(opt.depth) ? opt.depth : 0.1,
			steps = Math.max(1, opt.steps | 0 || 1),
			hz = d / 2;
		var twist = isNum(opt.twistDeg) ? opt.twistDeg : 0,
			scEnd = isNum(opt.scaleEnd) ? opt.scaleEnd : 1;
		var bev =
			opt.bevel && opt.bevel.size > 0
				? { size: Math.min(opt.bevel.size, hz * 0.98), seg: Math.max(1, opt.bevel.seg | 0 || 2) }
				: null;
		var bs = bev ? bev.size : 0;
		var stations = [],
			k;
		if (bev)
			for (k = bev.seg; k >= 1; k--) {
				var a0 = ((k / bev.seg) * Math.PI) / 2;
				stations.push({ z: -hz + bs - Math.sin(a0) * bs, inset: bs * (1 - Math.cos(a0)) });
			}
		for (k = 0; k <= steps; k++) stations.push({ z: lerp(-hz + bs, hz - bs, k / steps), inset: 0 });
		if (bev)
			for (k = 1; k <= bev.seg; k++) {
				var a1 = ((k / bev.seg) * Math.PI) / 2;
				stations.push({ z: hz - bs + Math.sin(a1) * bs, inset: bs * (1 - Math.cos(a1)) });
			}
		function ringAt(basePts, st) {
			var rp = st.inset > 0 ? offsetPts(basePts, st.inset) : basePts;
			var t = (st.z + hz) / (d || 1),
				c = Math.cos(twist * t * DEG),
				s = Math.sin(twist * t * DEG),
				sc = lerp(1, scEnd, t);
			return rp.map(function (p) {
				var x = p[0] * sc,
					y = p[1] * sc;
				return [x * c - y * s, x * s + y * c, st.z];
			});
		}
		var m = startMesh(opt.name || 'extrude'),
			rows = stations.length - 1;
		function wall(basePts) {
			var nn = basePts.length;
			var rings = stations.map(function (st) {
				return ringAt(basePts, st);
			});
			gridPatch(m, nn, rows, function (u, v) {
				var ri = Math.round(u * nn) % nn,
					si = Math.round(v * rows);
				return rings[si][ri];
			});
		}
		wall(pts);
		for (var hI = 0; hI < holes.length; hI++) wall(holes[hI]);
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		function cap(st, flip) {
			var o = st.inset > 0 ? offsetPts(pts, st.inset) : pts;
			var hs = holes.map(function (h) {
				return st.inset > 0 ? offsetPts(h, st.inset) : h;
			});
			var tri = triangulateShape({ pts: o, holes: hs });
			var t = (st.z + hz) / (d || 1),
				c = Math.cos(twist * t * DEG),
				s = Math.sin(twist * t * DEG),
				sc = lerp(1, scEnd, t);
			var base = m.vertCount(),
				mnx = 1 / 0,
				mny = 1 / 0,
				mxx = -1 / 0,
				mxy = -1 / 0,
				q,
				p;
			for (q = 0; q < tri.points.length; q++) {
				p = tri.points[q];
				if (p[0] < mnx) mnx = p[0];
				if (p[0] > mxx) mxx = p[0];
				if (p[1] < mny) mny = p[1];
				if (p[1] > mxy) mxy = p[1];
			}
			var w = mxx - mnx || 1,
				h2 = mxy - mny || 1;
			for (q = 0; q < tri.points.length; q++) {
				p = tri.points[q];
				var x = p[0] * sc,
					y = p[1] * sc;
				m.pos.push(x * c - y * s, x * s + y * c, st.z);
				m.uv.push((p[0] - mnx) / w, (p[1] - mny) / h2);
			}
			for (var f = 0; f < tri.tris.length; f += 3) {
				if (flip) m.idx.push(base + tri.tris[f], base + tri.tris[f + 2], base + tri.tris[f + 1]);
				else m.idx.push(base + tri.tris[f], base + tri.tris[f + 1], base + tri.tris[f + 2]);
			}
		}
		if (opt.caps !== false) {
			cap(stations[rows], false);
			cap(stations[0], true);
		}
		stripDegenerate(m);
		m.weld({ eps: 1e-9, ignoreUv: false });
		m.computeNormals({ angleDeg: isNum(opt.smoothDeg) ? opt.smoothDeg : 46 });
		return m;
	}
	function capFan(m, ring, flip) {
		var c = [0, 0, 0],
			n = ring.length,
			base = m.vertCount(),
			i;
		for (i = 0; i < n; i++) c = vadd(c, ring[i]);
		c = vmul(c, 1 / n);
		m.pos.push(c[0], c[1], c[2]);
		m.uv.push(0.5, 0.5);
		for (i = 0; i <= n; i++) {
			var p = ring[i % n];
			m.pos.push(p[0], p[1], p[2]);
			m.uv.push(i / n, 0);
		}
		for (i = 0; i < n; i++) {
			var a = base + 1 + i,
				b = base + 2 + i;
			if (flip) m.idx.push(base, b, a);
			else m.idx.push(base, a, b);
		}
	}
	function loft(sections, opt) {
		opt = opt || {};
		if (!sections || sections.length < 2)
			throw new Error('loft: precisa de 2+ aneis de pontos 3D com a mesma contagem');
		var n = sections[0].length;
		for (var i = 1; i < sections.length; i++)
			if (sections[i].length !== n)
				throw new Error('loft: todos os aneis precisam ter ' + n + ' pontos');
		var closed = opt.closeRings !== false,
			rows = sections.length - 1,
			segN = closed ? n : n - 1;
		var m = startMesh(opt.name || 'loft');
		gridPatch(m, segN, rows, function (u, v) {
			var ri = Math.round(u * segN) % n,
				pi = Math.round(v * rows);
			return sections[pi][ri];
		});
		m.uv = m.__uvtmp;
		delete m.__uvtmp;
		if (opt.caps && closed) {
			capFan(m, sections[0], true);
			capFan(m, sections[rows], false);
		}
		stripDegenerate(m);
		m.weld({ eps: 1e-9, ignoreUv: false });
		m.computeNormals({ angleDeg: isNum(opt.smoothDeg) ? opt.smoothDeg : 46 });
		return m;
	}
	var Path = {
		line: function (a, b, steps) {
			steps = Math.max(1, steps | 0 || 8);
			var o = [];
			for (var i = 0; i <= steps; i++) o.push(vlerp(a, b, i / steps));
			return o;
		},
		circle: function (r, steps) {
			steps = Math.max(3, steps | 0 || 24);
			var o = [];
			for (var i = 0; i <= steps; i++) {
				var a = (i / steps) * Math.PI * 2;
				o.push([Math.cos(a) * r, 0, -Math.sin(a) * r]);
			}
			return o;
		},
		arc: function (r, a0deg, a1deg, steps) {
			steps = Math.max(2, steps | 0 || 16);
			var o = [];
			for (var i = 0; i <= steps; i++) {
				var a = lerp(a0deg, a1deg, i / steps) * DEG;
				o.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
			}
			return o;
		},
		helix: function (r, pitch, turns, steps) {
			steps = Math.max(8, steps | 0 || 64);
			var o = [];
			for (var i = 0; i <= steps; i++) {
				var t = i / steps,
					a = t * turns * Math.PI * 2;
				o.push([Math.cos(a) * r, t * pitch * turns, -Math.sin(a) * r]);
			}
			return o;
		},
		bezier: function (p0, c1, c2, p1, steps) {
			steps = Math.max(2, steps | 0 || 16);
			var o = [];
			for (var i = 0; i <= steps; i++) {
				var t = i / steps,
					mt = 1 - t,
					w0 = mt * mt * mt,
					w1 = 3 * mt * mt * t,
					w2 = 3 * mt * t * t,
					w3 = t * t * t;
				o.push([
					w0 * p0[0] + w1 * c1[0] + w2 * c2[0] + w3 * p1[0],
					w0 * p0[1] + w1 * c1[1] + w2 * c2[1] + w3 * p1[1],
					w0 * p0[2] + w1 * c1[2] + w2 * c2[2] + w3 * p1[2],
				]);
			}
			return o;
		},
		spline: function (pts, steps) {
			if (!pts || pts.length < 2) throw new Error('spline: 2+ pontos');
			steps = Math.max(pts.length, steps | 0 || pts.length * 8);
			function cr(p0, p1, p2, p3, t) {
				var t2 = t * t,
					t3 = t2 * t;
				return (
					0.5 *
					(2 * p1 +
						(-p0 + p2) * t +
						(2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
						(-p0 + 3 * p1 - 3 * p2 + p3) * t3)
				);
			}
			var o = [];
			for (var i = 0; i <= steps; i++) {
				var tt = (i / steps) * (pts.length - 1),
					si = Math.min(pts.length - 2, Math.floor(tt)),
					t = tt - si;
				var p0 = pts[Math.max(0, si - 1)],
					p1 = pts[si],
					p2 = pts[si + 1],
					p3 = pts[Math.min(pts.length - 1, si + 2)];
				o.push([
					cr(p0[0], p1[0], p2[0], p3[0], t),
					cr(p0[1], p1[1], p2[1], p3[1], t),
					cr(p0[2], p1[2], p2[2], p3[2], t),
				]);
			}
			return o;
		},
	};

	function Selection(mesh, weights) {
		this.mesh = mesh;
		this.w = weights;
	}
	Selection.prototype.count = function () {
		var c = 0;
		for (var i = 0; i < this.w.length; i++) if (this.w[i] > 0) c++;
		return c;
	};
	Selection.prototype.move = function (x, y, z) {
		var p = this.mesh.pos;
		for (var v = 0; v < this.w.length; v++) {
			var w = this.w[v];
			if (w > 0) {
				p[v * 3] += x * w;
				p[v * 3 + 1] += y * w;
				p[v * 3 + 2] += z * w;
			}
		}
		return this;
	};
	Selection.prototype.alongNormal = function (d) {
		var m = this.mesh;
		if (!m.nrm) m.computeNormals('smooth');
		var p = m.pos,
			n = m.nrm;
		for (var v = 0; v < this.w.length; v++) {
			var w = this.w[v];
			if (w > 0) {
				p[v * 3] += n[v * 3] * d * w;
				p[v * 3 + 1] += n[v * 3 + 1] * d * w;
				p[v * 3 + 2] += n[v * 3 + 2] * d * w;
			}
		}
		return this;
	};
	Selection.prototype.scaleAbout = function (c, fx, fy, fz) {
		if (fy == null) {
			fy = fx;
			fz = fx;
		}
		var p = this.mesh.pos;
		for (var v = 0; v < this.w.length; v++) {
			var w = this.w[v];
			if (w > 0) {
				p[v * 3] = lerp(p[v * 3], c[0] + (p[v * 3] - c[0]) * fx, w);
				p[v * 3 + 1] = lerp(p[v * 3 + 1], c[1] + (p[v * 3 + 1] - c[1]) * fy, w);
				p[v * 3 + 2] = lerp(p[v * 3 + 2], c[2] + (p[v * 3 + 2] - c[2]) * fz, w);
			}
		}
		return this;
	};
	Selection.prototype.rotateAbout = function (c, axis, deg) {
		var p = this.mesh.pos,
			R = mRotAxis(axis, deg);
		for (var v = 0; v < this.w.length; v++) {
			var w = this.w[v];
			if (w > 0) {
				var q = [p[v * 3] - c[0], p[v * 3 + 1] - c[1], p[v * 3 + 2] - c[2]];
				var t = mApplyP(R, q);
				p[v * 3] = lerp(p[v * 3], t[0] + c[0], w);
				p[v * 3 + 1] = lerp(p[v * 3 + 1], t[1] + c[1], w);
				p[v * 3 + 2] = lerp(p[v * 3 + 2], t[2] + c[2], w);
			}
		}
		return this;
	};
	Selection.prototype.smooth = function (iters) {
		iters = iters || 1;
		var m = this.mesh;
		for (var it = 0; it < iters; it++) {
			var adj = meshAdjacency(m),
				p = m.pos,
				np = p.slice();
			for (var v = 0; v < this.w.length; v++) {
				var w = this.w[v];
				if (w <= 0) continue;
				var an = adj[v];
				if (!an || !an.length) continue;
				var ax = 0,
					ay = 0,
					az = 0;
				for (var q = 0; q < an.length; q++) {
					ax += p[an[q] * 3];
					ay += p[an[q] * 3 + 1];
					az += p[an[q] * 3 + 2];
				}
				ax /= an.length;
				ay /= an.length;
				az /= an.length;
				np[v * 3] = lerp(p[v * 3], ax, 0.6 * w);
				np[v * 3 + 1] = lerp(p[v * 3 + 1], ay, 0.6 * w);
				np[v * 3 + 2] = lerp(p[v * 3 + 2], az, 0.6 * w);
			}
			m.pos = np;
		}
		return this;
	};
	function meshAdjacency(m) {
		var adj = new Array(m.vertCount());
		var ix = m.idx;
		for (var i = 0; i < ix.length; i += 3)
			for (var k = 0; k < 3; k++) {
				var a = ix[i + k],
					b = ix[i + ((k + 1) % 3)];
				(adj[a] = adj[a] || []).push(b);
				(adj[b] = adj[b] || []).push(a);
			}
		return adj;
	}
	Mesh.prototype.select = function (sel) {
		var vc = this.vertCount(),
			w = new Array(vc).fill(0),
			p = this.pos;
		var soft = sel && isNum(sel.soft) ? sel.soft : 0;
		function inside(x, y, z) {
			if (typeof sel === 'function') return sel(x, y, z) ? 1 : 0;
			if (sel.box) {
				var mn = sel.box.min,
					mx = sel.box.max;
				return x >= mn[0] && x <= mx[0] && y >= mn[1] && y <= mx[1] && z >= mn[2] && z <= mx[2]
					? 1
					: 0;
			}
			if (sel.sphere) {
				var d = Math.hypot(x - sel.sphere.c[0], y - sel.sphere.c[1], z - sel.sphere.c[2]);
				return d <= sel.sphere.r ? 1 : 0;
			}
			if (isNum(sel.aboveY)) return y >= sel.aboveY ? 1 : 0;
			if (isNum(sel.belowY)) return y <= sel.belowY ? 1 : 0;
			if (sel.all) return 1;
			throw new Error('select: use função (x,y,z)=>bool ou {box|sphere|aboveY|belowY|all, soft}');
		}
		for (var v = 0; v < vc; v++) w[v] = inside(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
		if (soft > 0) {
			var hard = [];
			for (var h = 0; h < vc; h++) if (w[h] > 0) hard.push(h);
			for (var v2 = 0; v2 < vc; v2++) {
				if (w[v2] > 0) continue;
				var best = 1 / 0;
				for (var q = 0; q < hard.length; q++) {
					var hv = hard[q] * 3,
						d2 = Math.hypot(
							p[v2 * 3] - p[hv],
							p[v2 * 3 + 1] - p[hv + 1],
							p[v2 * 3 + 2] - p[hv + 2],
						);
					if (d2 < best) best = d2;
				}
				if (best < soft) w[v2] = smoothstep(1 - best / soft);
			}
		}
		return new Selection(this, w);
	};
	Mesh.prototype.displace = function (fn) {
		if (!this.nrm) this.computeNormals('smooth');
		var p = this.pos,
			n = this.nrm;
		var f = typeof fn === 'function' ? fn : null;
		var o = !f && fn ? fn : {};
		var scale = isNum(o.scale) ? o.scale : 3,
			amp = isNum(o.amp) ? o.amp : 0.02,
			seed = o.seed | 0 || 1,
			oct = o.octaves | 0 || 3;
		for (var v = 0; v < p.length / 3; v++) {
			var x = p[v * 3],
				y = p[v * 3 + 1],
				z = p[v * 3 + 2],
				d;
			if (f) d = f(x, y, z, [n[v * 3], n[v * 3 + 1], n[v * 3 + 2]]) || 0;
			else
				d =
					(fbm2(x * scale + z * scale * 0.7, y * scale - z * scale * 0.3, seed, oct) - 0.5) *
					2 *
					amp;
			p[v * 3] += n[v * 3] * d;
			p[v * 3 + 1] += n[v * 3 + 1] * d;
			p[v * 3 + 2] += n[v * 3 + 2] * d;
		}
		return this.computeNormals({ angleDeg: 80 });
	};
	Mesh.prototype.twist = function (totalDeg, axis) {
		axis = axis || 'y';
		var b = this.bbox(),
			i0 = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
		var span = b.max[i0] - b.min[i0] || 1,
			p = this.pos;
		for (var v = 0; v < p.length / 3; v++) {
			var t = (p[v * 3 + i0] - b.min[i0]) / span,
				ang = totalDeg * t * DEG,
				c = Math.cos(ang),
				s = Math.sin(ang);
			if (i0 === 1) {
				var x = p[v * 3],
					z = p[v * 3 + 2];
				p[v * 3] = x * c - z * s;
				p[v * 3 + 2] = x * s + z * c;
			} else if (i0 === 0) {
				var y = p[v * 3 + 1],
					z2 = p[v * 3 + 2];
				p[v * 3 + 1] = y * c - z2 * s;
				p[v * 3 + 2] = y * s + z2 * c;
			} else {
				var x2 = p[v * 3],
					y2 = p[v * 3 + 1];
				p[v * 3] = x2 * c - y2 * s;
				p[v * 3 + 1] = x2 * s + y2 * c;
			}
		}
		return this.computeNormals({ angleDeg: 80 });
	};
	Mesh.prototype.taper = function (fTop, axis, fBottom) {
		axis = axis || 'y';
		if (!isNum(fBottom)) fBottom = 1;
		var b = this.bbox(),
			i0 = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
		var span = b.max[i0] - b.min[i0] || 1,
			p = this.pos;
		for (var v = 0; v < p.length / 3; v++) {
			var t = (p[v * 3 + i0] - b.min[i0]) / span,
				f = lerp(fBottom, fTop, t);
			if (i0 === 1) {
				p[v * 3] *= f;
				p[v * 3 + 2] *= f;
			} else if (i0 === 0) {
				p[v * 3 + 1] *= f;
				p[v * 3 + 2] *= f;
			} else {
				p[v * 3] *= f;
				p[v * 3 + 1] *= f;
			}
		}
		return this.computeNormals({ angleDeg: 80 });
	};
	Mesh.prototype.bend = function (totalDeg, axis) {
		axis = axis || 'y';
		var b = this.bbox();
		var i0 = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
		var span = b.max[i0] - b.min[i0] || 1;
		if (Math.abs(totalDeg) < 1e-9) return this;
		var R = span / (totalDeg * DEG),
			p = this.pos;
		for (var v = 0; v < p.length / 3; v++) {
			var t = (p[v * 3 + i0] - b.min[i0]) / span,
				ang = totalDeg * t * DEG;
			if (i0 === 1) {
				var x = p[v * 3];
				p[v * 3] = Math.sin(ang) * (R - x);
				p[v * 3 + 1] = b.min[1] + (R - x) * (1 - Math.cos(ang)) + (x < 0 ? 0 : 0);
				p[v * 3 + 1] = b.min[1] + (1 - Math.cos(ang)) * (R - x);
			} else if (i0 === 0) {
				var y = p[v * 3 + 1];
				p[v * 3 + 1] = Math.sin(ang) * (R - y);
				p[v * 3] = b.min[0] + (1 - Math.cos(ang)) * (R - y);
			} else {
				var x3 = p[v * 3];
				p[v * 3] = Math.sin(ang) * (R - x3);
				p[v * 3 + 2] = b.min[2] + (1 - Math.cos(ang)) * (R - x3);
			}
		}
		return this.computeNormals({ angleDeg: 80 });
	};
	Mesh.prototype.mirror = function (axis, opt) {
		opt = opt || {};
		axis = axis || 'x';
		var i0 = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
		var other = this.clone(),
			p = other.pos,
			n = other.nrm;
		for (var v = 0; v < p.length / 3; v++) {
			p[v * 3 + i0] = -p[v * 3 + i0];
			if (n) n[v * 3 + i0] = -n[v * 3 + i0];
		}
		other.flipWinding();
		this.merge(other);
		if (opt.weld !== false) this.weld({ eps: opt.eps || 1e-5, ignoreUv: true });
		return this.computeNormals({ angleDeg: 60 });
	};
	Mesh.prototype.arrayLinear = function (count, offset) {
		var out = this.clone();
		for (var i = 1; i < count; i++) {
			var c = this.clone().translate(offset[0] * i, offset[1] * i, offset[2] * i);
			out.merge(c);
		}
		this.pos = out.pos;
		this.nrm = out.nrm;
		this.uv = out.uv;
		this.idx = out.idx;
		return this;
	};
	Mesh.prototype.arrayRadial = function (count, opt) {
		opt = opt || {};
		var axis = opt.axis || [0, 1, 0],
			center = opt.center || [0, 0, 0],
			start = opt.startDeg || 0,
			step = isNum(opt.stepDeg) ? opt.stepDeg : 360 / count;
		var out = null;
		for (var i = 0; i < count; i++) {
			var c = this.clone()
				.translate(-center[0], -center[1], -center[2])
				.rotate(axis, start + step * i)
				.translate(center[0], center[1], center[2]);
			if (!out) out = c;
			else out.merge(c);
		}
		this.pos = out.pos;
		this.nrm = out.nrm;
		this.uv = out.uv;
		this.idx = out.idx;
		return this;
	};
	Mesh.prototype.subdivide = function (opt) {
		opt = opt || {};
		var iters = Math.max(1, opt.iterations | 0 || 1),
			smoothA = opt.smooth !== false;
		for (var it = 0; it < iters; it++) {
			var p = this.pos,
				uv = this.uv,
				ix = this.idx,
				cache = new Map(),
				np = p.slice(),
				nuv = uv ? uv.slice() : null,
				ni = [];
			var self = this;
			function midpoint(a, b) {
				var k = a < b ? a + '_' + b : b + '_' + a,
					g = cache.get(k);
				if (g != null) return g;
				var vi = np.length / 3;
				np.push(
					(p[a * 3] + p[b * 3]) / 2,
					(p[a * 3 + 1] + p[b * 3 + 1]) / 2,
					(p[a * 3 + 2] + p[b * 3 + 2]) / 2,
				);
				if (nuv) nuv.push((uv[a * 2] + uv[b * 2]) / 2, (uv[a * 2 + 1] + uv[b * 2 + 1]) / 2);
				cache.set(k, vi);
				return vi;
			}
			for (var f = 0; f < ix.length; f += 3) {
				var a = ix[f],
					b = ix[f + 1],
					c = ix[f + 2],
					ab = midpoint(a, b),
					bc = midpoint(b, c),
					ca = midpoint(c, a);
				ni.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
			}
			this.pos = np;
			this.uv = nuv;
			this.idx = ni;
			this.nrm = null;
			if (smoothA) this.select({ all: true }).smooth(1);
		}
		return this.computeNormals({ angleDeg: 60 });
	};
	Mesh.prototype.extrudeFaces = function (pred, opt) {
		opt = opt || {};
		var dist = isNum(opt.dist) ? opt.dist : 0.05,
			inset = isNum(opt.inset) ? opt.inset : 0;
		var p = this.pos,
			ix = this.idx,
			keep = [],
			ext = [];
		for (var f = 0; f < ix.length; f += 3) {
			var a = ix[f] * 3,
				b = ix[f + 1] * 3,
				c = ix[f + 2] * 3;
			var cx = (p[a] + p[b] + p[c]) / 3,
				cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3,
				cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
			var n = vnorm(
				vcross(
					[p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]],
					[p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]],
				),
			);
			if (pred([cx, cy, cz], n, f / 3)) ext.push(f);
			else keep.push(f);
		}
		if (!ext.length) return this;
		var np = p.slice(),
			nuv = this.uv ? this.uv.slice() : null,
			ni = [];
		for (var k = 0; k < keep.length; k++) {
			var kf = keep[k];
			ni.push(ix[kf], ix[kf + 1], ix[kf + 2]);
		}
		for (var e = 0; e < ext.length; e++) {
			var f2 = ext[e],
				ia = ix[f2],
				ib = ix[f2 + 1],
				ic = ix[f2 + 2];
			var A = [p[ia * 3], p[ia * 3 + 1], p[ia * 3 + 2]],
				B = [p[ib * 3], p[ib * 3 + 1], p[ib * 3 + 2]],
				C = [p[ic * 3], p[ic * 3 + 1], p[ic * 3 + 2]];
			var n2 = vnorm(vcross(vsub(B, A), vsub(C, A))),
				cen = vmul(vadd(vadd(A, B), C), 1 / 3);
			function newV(P) {
				var q = vadd(P, vmul(n2, dist));
				if (inset > 0) q = vlerp(q, vadd(cen, vmul(n2, dist)), clamp(inset, 0, 0.95));
				var vi = np.length / 3;
				np.push(q[0], q[1], q[2]);
				if (nuv) nuv.push(0.5, 0.5);
				return vi;
			}
			var na = newV(A),
				nb = newV(B),
				nc = newV(C);
			ni.push(na, nb, nc);
			ni.push(ia, ib, nb, ia, nb, na, ib, ic, nc, ib, nc, nb, ic, ia, na, ic, na, nc);
		}
		this.pos = np;
		this.uv = nuv;
		this.idx = ni;
		this.nrm = null;
		return this.computeNormals({ angleDeg: 46 });
	};

	var CSG_EPS = 1e-5;
	function CsgV(p, n, uv) {
		this.p = p;
		this.n = n;
		this.uv = uv;
	}
	CsgV.prototype.flip = function () {
		this.n = vmul(this.n, -1);
	};
	CsgV.prototype.lerpTo = function (o, t) {
		return new CsgV(vlerp(this.p, o.p, t), vnorm(vlerp(this.n, o.n, t)), [
			lerp(this.uv[0], o.uv[0], t),
			lerp(this.uv[1], o.uv[1], t),
		]);
	};
	function CsgPlane(n, w) {
		this.n = n;
		this.w = w;
	}
	CsgPlane.fromPoints = function (a, b, c) {
		var n = vnorm(vcross(vsub(b, a), vsub(c, a)));
		return new CsgPlane(n, vdot(n, a));
	};
	CsgPlane.prototype.flip = function () {
		this.n = vmul(this.n, -1);
		this.w = -this.w;
	};
	CsgPlane.prototype.splitPolygon = function (poly, coFront, coBack, front, back) {
		var COPLANAR = 0,
			FRONT = 1,
			BACK = 2,
			SPANNING = 3,
			type = 0,
			types = [];
		for (var i = 0; i < poly.v.length; i++) {
			var t = vdot(this.n, poly.v[i].p) - this.w;
			var ty = t < -CSG_EPS ? BACK : t > CSG_EPS ? FRONT : COPLANAR;
			type |= ty;
			types.push(ty);
		}
		switch (type) {
			case COPLANAR:
				(vdot(this.n, poly.plane.n) > 0 ? coFront : coBack).push(poly);
				break;
			case FRONT:
				front.push(poly);
				break;
			case BACK:
				back.push(poly);
				break;
			case SPANNING:
				var f = [],
					b = [];
				for (var j = 0; j < poly.v.length; j++) {
					var k = (j + 1) % poly.v.length,
						ti = types[j],
						tk = types[k],
						vi = poly.v[j],
						vk = poly.v[k];
					if (ti !== BACK) f.push(vi);
					if (ti !== FRONT)
						b.push(ti !== BACK ? new CsgV(vi.p.slice(), vi.n.slice(), vi.uv.slice()) : vi);
					if ((ti | tk) === SPANNING) {
						var t2 = (this.w - vdot(this.n, vi.p)) / vdot(this.n, vsub(vk.p, vi.p));
						var mid = vi.lerpTo(vk, t2);
						f.push(mid);
						b.push(new CsgV(mid.p.slice(), mid.n.slice(), mid.uv.slice()));
					}
				}
				if (f.length >= 3) front.push(new CsgPoly(f, poly.shared));
				if (b.length >= 3) back.push(new CsgPoly(b, poly.shared));
				break;
		}
	};
	function CsgPoly(v, shared) {
		this.v = v;
		this.shared = shared | 0;
		this.plane = CsgPlane.fromPoints(v[0].p, v[1].p, v[2].p);
	}
	CsgPoly.prototype.flip = function () {
		this.v.reverse();
		for (var i = 0; i < this.v.length; i++) this.v[i].flip();
		this.plane.flip();
	};
	CsgPoly.prototype.clone = function () {
		return new CsgPoly(
			this.v.map(function (x) {
				return new CsgV(x.p.slice(), x.n.slice(), x.uv.slice());
			}),
			this.shared,
		);
	};
	function CsgNode(polys) {
		this.plane = null;
		this.front = null;
		this.back = null;
		this.polys = [];
		if (polys) this.build(polys);
	}
	CsgNode.prototype.invert = function () {
		for (var i = 0; i < this.polys.length; i++) this.polys[i].flip();
		if (this.plane) this.plane.flip();
		if (this.front) this.front.invert();
		if (this.back) this.back.invert();
		var t = this.front;
		this.front = this.back;
		this.back = t;
	};
	CsgNode.prototype.clipPolygons = function (polys) {
		if (!this.plane) return polys.slice();
		var front = [],
			back = [];
		for (var i = 0; i < polys.length; i++)
			this.plane.splitPolygon(polys[i], front, back, front, back);
		if (this.front) front = this.front.clipPolygons(front);
		back = this.back ? this.back.clipPolygons(back) : [];
		return front.concat(back);
	};
	CsgNode.prototype.clipTo = function (bsp) {
		this.polys = bsp.clipPolygons(this.polys);
		if (this.front) this.front.clipTo(bsp);
		if (this.back) this.back.clipTo(bsp);
	};
	CsgNode.prototype.allPolygons = function () {
		var out = this.polys.slice();
		if (this.front) out = out.concat(this.front.allPolygons());
		if (this.back) out = out.concat(this.back.allPolygons());
		return out;
	};
	CsgNode.prototype.build = function (polys) {
		if (!polys.length) return;
		if (!this.plane) this.plane = new CsgPlane(polys[0].plane.n.slice(), polys[0].plane.w);
		var front = [],
			back = [];
		for (var i = 0; i < polys.length; i++)
			this.plane.splitPolygon(polys[i], this.polys, this.polys, front, back);
		if (front.length) {
			if (!this.front) this.front = new CsgNode();
			this.front.build(front);
		}
		if (back.length) {
			if (!this.back) this.back = new CsgNode();
			this.back.build(back);
		}
	};
	function meshToPolys(m, shared) {
		var polys = [],
			p = m.pos,
			n = m.nrm,
			uv = m.uv,
			ix = m.idx;
		if (!n) {
			m.computeNormals('smooth');
			n = m.nrm;
		}
		for (var f = 0; f < ix.length; f += 3) {
			var vs = [];
			for (var k = 0; k < 3; k++) {
				var v = ix[f + k];
				vs.push(
					new CsgV(
						[p[v * 3], p[v * 3 + 1], p[v * 3 + 2]],
						[n[v * 3], n[v * 3 + 1], n[v * 3 + 2]],
						uv ? [uv[v * 2], uv[v * 2 + 1]] : [0, 0],
					),
				);
			}
			var e1 = vsub(vs[1].p, vs[0].p),
				e2 = vsub(vs[2].p, vs[0].p);
			if (vlen(vcross(e1, e2)) < 1e-12) continue;
			polys.push(new CsgPoly(vs, shared));
		}
		return polys;
	}
	function polysToMesh(polys, name) {
		var m = new Mesh(name);
		m.nrm = [];
		m.uv = [];
		for (var i = 0; i < polys.length; i++) {
			var v = polys[i].v,
				base = m.vertCount();
			for (var j = 0; j < v.length; j++) {
				m.pos.push(v[j].p[0], v[j].p[1], v[j].p[2]);
				m.nrm.push(v[j].n[0], v[j].n[1], v[j].n[2]);
				m.uv.push(v[j].uv[0], v[j].uv[1]);
			}
			for (var k = 2; k < v.length; k++) m.idx.push(base, base + k - 1, base + k);
		}
		m.weld({ eps: 1e-6, ignoreUv: false });
		return m;
	}
	function csgOp(a, b, op) {
		var A = new CsgNode(meshToPolys(a, 0)),
			B = new CsgNode(meshToPolys(b, 1));
		if (op === 'union') {
			A.clipTo(B);
			B.clipTo(A);
			B.invert();
			B.clipTo(A);
			B.invert();
			A.build(B.allPolygons());
		} else if (op === 'subtract') {
			A.invert();
			A.clipTo(B);
			B.clipTo(A);
			B.invert();
			B.clipTo(A);
			B.invert();
			A.build(B.allPolygons());
			A.invert();
		} else {
			A.invert();
			B.clipTo(A);
			B.invert();
			A.clipTo(B);
			B.clipTo(A);
			A.build(B.allPolygons());
			A.invert();
		}
		var m = polysToMesh(A.allPolygons(), a.name);
		m.__fromCsg = true;
		return m.computeNormals({ angleDeg: 46 });
	}
	function csgUnion(a, b) {
		return csgOp(a, b, 'union');
	}
	function csgSubtract(a, b) {
		return csgOp(a, b, 'subtract');
	}
	function csgIntersect(a, b) {
		return csgOp(a, b, 'intersect');
	}

	Mesh.prototype.uvBox = function (opt) {
		opt = opt || {};
		var s = isNum(opt.scale) ? opt.scale : 1;
		if (!this.nrm) this.computeNormals({ angleDeg: 60 });
		var b = this.bbox(),
			d = vsub(b.max, b.min),
			mx = Math.max(d[0], d[1], d[2]) || 1,
			p = this.pos,
			n = this.nrm;
		this.uv = [];
		for (var v = 0; v < p.length / 3; v++) {
			var ax = Math.abs(n[v * 3]),
				ay = Math.abs(n[v * 3 + 1]),
				az = Math.abs(n[v * 3 + 2]);
			var x = ((p[v * 3] - b.min[0]) / mx) * s,
				y = ((p[v * 3 + 1] - b.min[1]) / mx) * s,
				z = ((p[v * 3 + 2] - b.min[2]) / mx) * s;
			if (ax >= ay && ax >= az) this.uv.push(z, y);
			else if (ay >= ax && ay >= az) this.uv.push(x, z);
			else this.uv.push(x, y);
		}
		return this;
	};
	Mesh.prototype.uvPlanar = function (axis, opt) {
		opt = opt || {};
		axis = axis || 'y';
		var s = isNum(opt.scale) ? opt.scale : 1;
		var b = this.bbox(),
			d = vsub(b.max, b.min),
			p = this.pos;
		this.uv = [];
		for (var v = 0; v < p.length / 3; v++) {
			var x = (p[v * 3] - b.min[0]) / (d[0] || 1),
				y = (p[v * 3 + 1] - b.min[1]) / (d[1] || 1),
				z = (p[v * 3 + 2] - b.min[2]) / (d[2] || 1);
			if (axis === 'y') this.uv.push(x * s, z * s);
			else if (axis === 'x') this.uv.push(z * s, y * s);
			else this.uv.push(x * s, y * s);
		}
		return this;
	};
	Mesh.prototype.uvCylindrical = function (opt) {
		opt = opt || {};
		var b = this.bbox(),
			p = this.pos;
		this.uv = [];
		var cx = (b.min[0] + b.max[0]) / 2,
			cz = (b.min[2] + b.max[2]) / 2,
			h = b.max[1] - b.min[1] || 1;
		for (var v = 0; v < p.length / 3; v++) {
			var u = 0.5 + Math.atan2(-(p[v * 3 + 2] - cz), p[v * 3] - cx) / (2 * Math.PI);
			this.uv.push(u * (opt.scaleU || 1), ((p[v * 3 + 1] - b.min[1]) / h) * (opt.scaleV || 1));
		}
		return this;
	};
	Mesh.prototype.uvSpherical = function () {
		var b = this.bbox(),
			p = this.pos;
		this.uv = [];
		var c = vmul(vadd(b.min, b.max), 0.5);
		for (var v = 0; v < p.length / 3; v++) {
			var d = vnorm(vsub([p[v * 3], p[v * 3 + 1], p[v * 3 + 2]], c));
			this.uv.push(
				0.5 + Math.atan2(-d[2], d[0]) / (2 * Math.PI),
				0.5 + Math.asin(clamp(d[1], -1, 1)) / Math.PI,
			);
		}
		return this;
	};
	Mesh.prototype.uvTransform = function (su, sv, ou, ov, rotDeg) {
		if (!this.uv) throw new Error('uvTransform: malha sem UV (gere com uvBox/uvPlanar/...)');
		var c = Math.cos((rotDeg || 0) * DEG),
			s = Math.sin((rotDeg || 0) * DEG);
		for (var i = 0; i < this.uv.length; i += 2) {
			var u = this.uv[i] * (su == null ? 1 : su),
				v = this.uv[i + 1] * (sv == null ? 1 : sv);
			this.uv[i] = u * c - v * s + (ou || 0);
			this.uv[i + 1] = u * s + v * c + (ov || 0);
		}
		return this;
	};

	function Tex(w, h) {
		this.__isTex = true;
		this.w = w || 512;
		this.h = h || 512;
		this.data = new Float32Array(this.w * this.h * 4);
		for (var i = 3; i < this.data.length; i += 4) this.data[i] = 1;
	}
	Tex.prototype.clone = function () {
		var t = new Tex(this.w, this.h);
		t.data.set(this.data);
		return t;
	};
	Tex.prototype.setPx = function (x, y, c) {
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
		var i = (y * this.w + x) * 4;
		var a = c.length > 3 ? c[3] : 1,
			d = this.data;
		d[i] = lerp(d[i], c[0], a);
		d[i + 1] = lerp(d[i + 1], c[1], a);
		d[i + 2] = lerp(d[i + 2], c[2], a);
		d[i + 3] = Math.max(d[i + 3], a);
		return this;
	};
	Tex.prototype.getPx = function (x, y) {
		x = ((x % this.w) + this.w) % this.w;
		y = ((y % this.h) + this.h) % this.h;
		var i = (y * this.w + x) * 4;
		return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
	};
	Tex.prototype.fill = function (c) {
		c = parseColor(c);
		for (var i = 0; i < this.data.length; i += 4) {
			this.data[i] = c[0];
			this.data[i + 1] = c[1];
			this.data[i + 2] = c[2];
			this.data[i + 3] = c[3];
		}
		return this;
	};
	Tex.prototype.fromFn = function (fn) {
		for (var y = 0; y < this.h; y++)
			for (var x = 0; x < this.w; x++) {
				var c = fn(x / this.w, y / this.h, x, y);
				if (c == null) continue;
				c = Array.isArray(c) ? c : [c, c, c];
				var i = (y * this.w + x) * 4;
				this.data[i] = c[0];
				this.data[i + 1] = c[1];
				this.data[i + 2] = c[2];
				this.data[i + 3] = c.length > 3 ? c[3] : 1;
			}
		return this;
	};
	Tex.prototype.forEach = function (fn) {
		for (var y = 0; y < this.h; y++)
			for (var x = 0; x < this.w; x++) {
				var i = (y * this.w + x) * 4;
				var r = fn(
					[this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]],
					x / this.w,
					y / this.h,
					x,
					y,
				);
				if (r) {
					this.data[i] = r[0];
					this.data[i + 1] = r[1];
					this.data[i + 2] = r[2];
					if (r.length > 3) this.data[i + 3] = r[3];
				}
			}
		return this;
	};
	Tex.prototype.rect = function (x, y, w, h, c) {
		c = parseColor(c);
		for (var j = Math.max(0, y | 0); j < Math.min(this.h, (y + h) | 0); j++)
			for (var i = Math.max(0, x | 0); i < Math.min(this.w, (x + w) | 0); i++) this.setPx(i, j, c);
		return this;
	};
	Tex.prototype.circle = function (cx, cy, r, c) {
		c = parseColor(c);
		for (var j = Math.max(0, (cy - r) | 0); j <= Math.min(this.h - 1, (cy + r) | 0); j++)
			for (var i = Math.max(0, (cx - r) | 0); i <= Math.min(this.w - 1, (cx + r) | 0); i++) {
				var d = Math.hypot(i - cx, j - cy);
				if (d <= r) this.setPx(i, j, c);
			}
		return this;
	};
	Tex.prototype.line = function (x0, y0, x1, y1, width, c) {
		c = parseColor(c);
		var len = Math.hypot(x1 - x0, y1 - y0),
			steps = Math.ceil(len * 2) + 1;
		for (var s = 0; s <= steps; s++) {
			var t = s / steps,
				x = lerp(x0, x1, t),
				y = lerp(y0, y1, t);
			for (var j = -width; j <= width; j++)
				for (var i = -width; i <= width; i++)
					if (i * i + j * j <= width * width) this.setPx((x + i) | 0, (y + j) | 0, c);
		}
		return this;
	};
	Tex.prototype.gradient = function (cA, cB, angleDeg) {
		cA = parseColor(cA);
		cB = parseColor(cB);
		var a = (angleDeg || 90) * DEG,
			dx = Math.cos(a),
			dy = Math.sin(a);
		return this.fromFn(function (u, v) {
			var t = clamp((u - 0.5) * dx + (v - 0.5) * dy + 0.5, 0, 1);
			return [
				lerp(cA[0], cB[0], t),
				lerp(cA[1], cB[1], t),
				lerp(cA[2], cB[2], t),
				lerp(cA[3], cB[3], t),
			];
		});
	};
	Tex.prototype.radial = function (cIn, cOut, cx, cy, r) {
		cIn = parseColor(cIn);
		cOut = parseColor(cOut);
		cx = cx == null ? 0.5 : cx;
		cy = cy == null ? 0.5 : cy;
		r = r || 0.7;
		return this.fromFn(function (u, v) {
			var t = clamp(Math.hypot(u - cx, v - cy) / r, 0, 1);
			return [lerp(cIn[0], cOut[0], t), lerp(cIn[1], cOut[1], t), lerp(cIn[2], cOut[2], t), 1];
		});
	};
	Tex.prototype.noise = function (opt) {
		opt = opt || {};
		var type = opt.type || 'fbm',
			scale = isNum(opt.scale) ? opt.scale : 6,
			seed = opt.seed | 0 || 1,
			oct = opt.octaves | 0 || 4;
		var cA = parseColor(opt.colorA != null ? opt.colorA : [0, 0, 0]),
			cB = parseColor(opt.colorB != null ? opt.colorB : [1, 1, 1]);
		var amount = isNum(opt.amount) ? opt.amount : 1;
		var self = this;
		return this.forEach(function (px, u, v) {
			var n;
			if (type === 'value') n = vnoise2(u * scale, v * scale, seed);
			else if (type === 'worley') n = worley2(u * scale, v * scale, seed).f1;
			else if (type === 'worley2')
				n = clamp(
					worley2(u * scale, v * scale, seed).f2 - worley2(u * scale, v * scale, seed).f1,
					0,
					1,
				);
			else if (type === 'ridged') n = ridged2(u * scale, v * scale, seed, oct);
			else n = fbm2(u * scale, v * scale, seed, oct);
			var t = clamp(n, 0, 1);
			return [
				lerp(px[0], lerp(cA[0], cB[0], t), amount),
				lerp(px[1], lerp(cA[1], cB[1], t), amount),
				lerp(px[2], lerp(cA[2], cB[2], t), amount),
				px[3],
			];
		});
	};
	Tex.prototype.checker = function (nx, ny, cA, cB) {
		cA = parseColor(cA);
		cB = parseColor(cB);
		nx = nx || 8;
		ny = ny || nx;
		return this.fromFn(function (u, v) {
			return (Math.floor(u * nx) + Math.floor(v * ny)) % 2 === 0 ? cA : cB;
		});
	};
	Tex.prototype.stripes = function (n, cA, cB, angleDeg, duty) {
		cA = parseColor(cA);
		cB = parseColor(cB);
		n = n || 8;
		duty = duty == null ? 0.5 : duty;
		var a = (angleDeg || 0) * DEG,
			dx = Math.cos(a),
			dy = Math.sin(a);
		return this.fromFn(function (u, v) {
			var t = (u * dx + v * dy) * n;
			return t - Math.floor(t) < duty ? cA : cB;
		});
	};
	Tex.prototype.grid = function (nx, ny, lineW, cLine, cBg) {
		cLine = parseColor(cLine);
		nx = nx || 8;
		ny = ny || nx;
		lineW = lineW || 0.04;
		var t2 = this;
		if (cBg != null) t2.fill(cBg);
		return this.forEach(function (px, u, v) {
			var fu = u * nx - Math.floor(u * nx),
				fv = v * ny - Math.floor(v * ny);
			if (fu < lineW || fv < lineW || fu > 1 - lineW || fv > 1 - lineW) return cLine;
			return null;
		});
	};
	Tex.prototype.dots = function (nx, ny, r, cDot) {
		cDot = parseColor(cDot);
		nx = nx || 8;
		ny = ny || nx;
		r = r || 0.25;
		return this.forEach(function (px, u, v) {
			var fu = u * nx - Math.floor(u * nx) - 0.5,
				fv = v * ny - Math.floor(v * ny) - 0.5;
			return Math.hypot(fu, fv) < r ? cDot : null;
		});
	};
	Tex.prototype.bricks = function (opt) {
		opt = opt || {};
		var rows = opt.rows || 8,
			cols = opt.cols || 4,
			mortar = isNum(opt.mortar) ? opt.mortar : 0.06;
		var cB = parseColor(opt.brick || '#9a4a33'),
			cM = parseColor(opt.mortar_color || '#b8b0a4'),
			vary = isNum(opt.vary) ? opt.vary : 0.12,
			seed = opt.seed | 0 || 7;
		return this.fromFn(function (u, v) {
			var row = Math.floor(v * rows),
				off = (row % 2) * 0.5,
				uu = u * cols + off;
			var col = Math.floor(uu),
				fu = uu - col,
				fv = v * rows - row;
			if (fu < mortar || fv < mortar || fu > 1 - mortar * 0.5 || fv > 1 - mortar) return cM;
			var h = hash2i(col, row, seed),
				f = 1 + (h - 0.5) * 2 * vary;
			var edge = Math.min(fu, fv, 1 - fu, 1 - fv) / 0.15,
				shade = 0.85 + 0.15 * clamp(edge, 0, 1);
			return [
				clamp(cB[0] * f * shade, 0, 1),
				clamp(cB[1] * f * shade, 0, 1),
				clamp(cB[2] * f * shade, 0, 1),
				1,
			];
		});
	};
	Tex.prototype.planks = function (opt) {
		opt = opt || {};
		var cols = opt.cols || 6,
			gap = isNum(opt.gap) ? opt.gap : 0.02,
			seed = opt.seed | 0 || 3;
		var cW = parseColor(opt.wood || '#8a5a33'),
			cG = parseColor(opt.gap_color || '#3a2417'),
			vary = isNum(opt.vary) ? opt.vary : 0.18,
			rings = opt.rings || 26;
		return this.fromFn(function (u, v) {
			var col = Math.floor(u * cols),
				fu = u * cols - col;
			if (fu < gap || fu > 1 - gap) return cG;
			var h = hash2i(col, 0, seed),
				f = 1 + (h - 0.5) * 2 * vary;
			var g = fbm2(u * 3 + h * 13, v * rings * (0.7 + h * 0.6), seed + col, 3);
			var grain = 0.82 + 0.18 * Math.abs(Math.sin((v * rings + g * 3 + h * 40) * Math.PI));
			var kn = worley2(u * cols * 1.5, v * 7 + h * 9, seed + 9).f1,
				knot = kn < 0.12 ? 0.72 + kn : 1;
			return [
				clamp(cW[0] * f * grain * knot, 0, 1),
				clamp(cW[1] * f * grain * knot, 0, 1),
				clamp(cW[2] * f * grain * knot, 0, 1),
				1,
			];
		});
	};
	Tex.prototype.scratches = function (count, c, seed, width) {
		c = parseColor(c);
		var rnd = mulberry32(seed | 0 || 11);
		count = count || 30;
		for (var i = 0; i < count; i++) {
			var x0 = rnd() * this.w,
				y0 = rnd() * this.h,
				ang = rnd() * Math.PI * 2,
				len = (0.05 + rnd() * 0.2) * this.w;
			var cc = [c[0], c[1], c[2], (0.2 + rnd() * 0.8) * c[3]];
			this.line(x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len, (width || 0) | 0, cc);
		}
		return this;
	};
	Tex.prototype.spots = function (count, rMin, rMax, c, seed) {
		c = parseColor(c);
		var rnd = mulberry32(seed | 0 || 5);
		count = count || 20;
		for (var i = 0; i < count; i++) {
			var r = lerp(rMin || 2, rMax || 14, rnd()),
				x = rnd() * this.w,
				y = rnd() * this.h;
			var cc = [c[0], c[1], c[2], (0.15 + rnd() * 0.5) * c[3]];
			this.circle(x, y, r, cc);
		}
		return this;
	};
	Tex.prototype.mul = function (other) {
		var o = other.__isTex ? null : parseColor(other);
		return this.forEach(function (px, u, v, x, y) {
			var q = o || other.getPx(x, y);
			return [px[0] * q[0], px[1] * q[1], px[2] * q[2], px[3]];
		});
	};
	Tex.prototype.add = function (other, f) {
		f = f == null ? 1 : f;
		var o = other.__isTex ? null : parseColor(other);
		return this.forEach(function (px, u, v, x, y) {
			var q = o || other.getPx(x, y);
			return [
				clamp(px[0] + q[0] * f, 0, 1),
				clamp(px[1] + q[1] * f, 0, 1),
				clamp(px[2] + q[2] * f, 0, 1),
				px[3],
			];
		});
	};
	Tex.prototype.mix = function (other, t) {
		var o = other.__isTex ? null : parseColor(other);
		return this.forEach(function (px, u, v, x, y) {
			var q = o || other.getPx(x, y);
			var tt = typeof t === 'function' ? t(u, v) : t == null ? 0.5 : t;
			return [lerp(px[0], q[0], tt), lerp(px[1], q[1], tt), lerp(px[2], q[2], tt), px[3]];
		});
	};
	Tex.prototype.adjust = function (opt) {
		opt = opt || {};
		var br = isNum(opt.brightness) ? opt.brightness : 0,
			ct = isNum(opt.contrast) ? opt.contrast : 0,
			sat = isNum(opt.saturation) ? opt.saturation : 0;
		return this.forEach(function (px) {
			var r = px[0] + br,
				g = px[1] + br,
				b = px[2] + br;
			if (ct) {
				r = (r - 0.5) * (1 + ct) + 0.5;
				g = (g - 0.5) * (1 + ct) + 0.5;
				b = (b - 0.5) * (1 + ct) + 0.5;
			}
			if (sat) {
				var l = r * 0.299 + g * 0.587 + b * 0.114;
				r = lerp(l, r, 1 + sat);
				g = lerp(l, g, 1 + sat);
				b = lerp(l, b, 1 + sat);
			}
			return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1), px[3]];
		});
	};
	Tex.prototype.levels = function (inLo, inHi, outLo, outHi) {
		outLo = outLo || 0;
		outHi = outHi == null ? 1 : outHi;
		return this.forEach(function (px) {
			function f(v) {
				return clamp(outLo + clamp((v - inLo) / (inHi - inLo || 1), 0, 1) * (outHi - outLo), 0, 1);
			}
			return [f(px[0]), f(px[1]), f(px[2]), px[3]];
		});
	};
	Tex.prototype.invert = function () {
		return this.forEach(function (px) {
			return [1 - px[0], 1 - px[1], 1 - px[2], px[3]];
		});
	};
	Tex.prototype.blur = function (radius) {
		radius = Math.max(1, radius | 0 || 1);
		var w = this.w,
			h = this.h,
			src = this.data,
			dst = new Float32Array(src.length);
		for (var pass = 0; pass < 2; pass++) {
			var horiz = pass === 0,
				from = pass === 0 ? src : dst,
				to = pass === 0 ? dst : src;
			for (var y = 0; y < h; y++)
				for (var x = 0; x < w; x++) {
					var r = 0,
						g = 0,
						b = 0,
						a = 0,
						cnt = 0;
					for (var k = -radius; k <= radius; k++) {
						var xx = horiz ? (x + k + w) % w : x,
							yy = horiz ? y : (y + k + h) % h,
							i = (yy * w + xx) * 4;
						r += from[i];
						g += from[i + 1];
						b += from[i + 2];
						a += from[i + 3];
						cnt++;
					}
					var o = (y * w + x) * 4;
					to[o] = r / cnt;
					to[o + 1] = g / cnt;
					to[o + 2] = b / cnt;
					to[o + 3] = a / cnt;
				}
		}
		return this;
	};
	Tex.prototype.gray = function () {
		return this.forEach(function (px) {
			var l = px[0] * 0.299 + px[1] * 0.587 + px[2] * 0.114;
			return [l, l, l, px[3]];
		});
	};
	Tex.prototype.normalFromHeight = function (strength) {
		strength = isNum(strength) ? strength : 2;
		var w = this.w,
			h = this.h,
			out = new Tex(w, h),
			s = this;
		function hAt(x, y) {
			var px = s.getPx(x, y);
			return px[0] * 0.299 + px[1] * 0.587 + px[2] * 0.114;
		}
		for (var y = 0; y < h; y++)
			for (var x = 0; x < w; x++) {
				var dx = (hAt(x + 1, y) - hAt(x - 1, y)) * strength,
					dy = (hAt(x, y + 1) - hAt(x, y - 1)) * strength;
				var n = vnorm([-dx, dy, 1]);
				var i = (y * w + x) * 4;
				out.data[i] = n[0] * 0.5 + 0.5;
				out.data[i + 1] = n[1] * 0.5 + 0.5;
				out.data[i + 2] = n[2] * 0.5 + 0.5;
				out.data[i + 3] = 1;
			}
		return out;
	};
	Tex.prototype.aoFromHeight = function (strength) {
		strength = isNum(strength) ? strength : 1.5;
		var blurred = this.clone().blur(Math.max(2, (this.w / 64) | 0));
		var out = new Tex(this.w, this.h),
			s = this;
		for (var y = 0; y < this.h; y++)
			for (var x = 0; x < this.w; x++) {
				var hp = s.getPx(x, y),
					bp = blurred.getPx(x, y);
				var hv = hp[0] * 0.299 + hp[1] * 0.587 + hp[2] * 0.114,
					bv = bp[0] * 0.299 + bp[1] * 0.587 + bp[2] * 0.114;
				var ao = clamp(1 - (bv - hv) * strength * 2, 0, 1),
					i = (y * this.w + x) * 4;
				out.data[i] = ao;
				out.data[i + 1] = ao;
				out.data[i + 2] = ao;
				out.data[i + 3] = 1;
			}
		return out;
	};
	function packMR(metal, rough, size) {
		var w = size || (metal && metal.__isTex ? metal.w : rough && rough.__isTex ? rough.w : 16);
		var t = new Tex(w, metal && metal.__isTex ? metal.h : rough && rough.__isTex ? rough.h : w);
		for (var y = 0; y < t.h; y++)
			for (var x = 0; x < t.w; x++) {
				var mv =
					metal && metal.__isTex
						? (function () {
								var q = metal.getPx(x, y);
								return q[0] * 0.299 + q[1] * 0.587 + q[2] * 0.114;
							})()
						: isNum(metal)
							? metal
							: 0;
				var rv =
					rough && rough.__isTex
						? (function () {
								var q = rough.getPx(x, y);
								return q[0] * 0.299 + q[1] * 0.587 + q[2] * 0.114;
							})()
						: isNum(rough)
							? rough
							: 0.8;
				var i = (y * t.w + x) * 4;
				t.data[i] = 1;
				t.data[i + 1] = clamp(rv, 0, 1);
				t.data[i + 2] = clamp(mv, 0, 1);
				t.data[i + 3] = 1;
			}
		return t;
	}

	var CRC_T = (function () {
		var t = new Int32Array(256);
		for (var n = 0; n < 256; n++) {
			var c = n;
			for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			t[n] = c;
		}
		return t;
	})();
	function crc32(buf, start, len) {
		var c = -1;
		for (var i = start; i < start + len; i++) c = CRC_T[(c ^ buf[i]) & 255] ^ (c >>> 8);
		return (c ^ -1) >>> 0;
	}
	function adler32(buf) {
		var a = 1,
			b = 0;
		for (var i = 0; i < buf.length; i++) {
			a = (a + buf[i]) % 65521;
			b = (b + a) % 65521;
		}
		return ((b << 16) | a) >>> 0;
	}
	function BitW() {
		this.bytes = [];
		this.bit = 0;
		this.cur = 0;
	}
	BitW.prototype.wb = function (value, count) {
		for (var i = 0; i < count; i++) {
			this.cur |= ((value >>> i) & 1) << this.bit;
			if (++this.bit === 8) {
				this.bytes.push(this.cur);
				this.cur = 0;
				this.bit = 0;
			}
		}
	};
	BitW.prototype.whuff = function (code, len) {
		for (var i = len - 1; i >= 0; i--) {
			this.cur |= ((code >>> i) & 1) << this.bit;
			if (++this.bit === 8) {
				this.bytes.push(this.cur);
				this.cur = 0;
				this.bit = 0;
			}
		}
	};
	BitW.prototype.end = function () {
		if (this.bit > 0) {
			this.bytes.push(this.cur);
			this.cur = 0;
			this.bit = 0;
		}
		return Uint8Array.from(this.bytes);
	};
	function fixedLit(v, bw) {
		if (v <= 143) bw.whuff(0x30 + v, 8);
		else if (v <= 255) bw.whuff(0x190 + (v - 144), 9);
		else if (v <= 279) bw.whuff(v - 256, 7);
		else bw.whuff(0xc0 + (v - 280), 8);
	}
	var LEN_BASE = [
		3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
		163, 195, 227, 258,
	];
	var LEN_XB = [
		0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
	];
	var DST_BASE = [
		1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
		3073, 4097, 6145, 8193, 12289, 16385, 24577,
	];
	var DST_XB = [
		0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
		13,
	];
	function deflateFixed(data) {
		var bw = new BitW();
		bw.wb(1, 1);
		bw.wb(1, 2);
		var n = data.length,
			HB = 16,
			head = new Int32Array(1 << HB).fill(-1),
			prev = new Int32Array(n).fill(-1);
		function h3(i) {
			return ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & ((1 << HB) - 1);
		}
		var i = 0;
		while (i < n) {
			var bestLen = 0,
				bestDist = 0;
			if (i + 2 < n) {
				var hh = h3(i),
					cand = head[hh],
					chain = 0;
				while (cand >= 0 && chain < 48 && i - cand <= 32768) {
					var l = 0,
						maxL = Math.min(258, n - i);
					while (l < maxL && data[cand + l] === data[i + l]) l++;
					if (l > bestLen) {
						bestLen = l;
						bestDist = i - cand;
						if (l >= maxL) break;
					}
					cand = prev[cand];
					chain++;
				}
			}
			if (bestLen >= 3) {
				var lc = 28;
				for (var q = 0; q < 29; q++)
					if (bestLen < LEN_BASE[q + 1] || q === 28) {
						lc = q;
						break;
					}
				while (lc < 28 && LEN_BASE[lc + 1] <= bestLen) lc++;
				if (LEN_BASE[lc] > bestLen) lc--;
				fixedLit(257 + lc, bw);
				if (LEN_XB[lc]) bw.wb(bestLen - LEN_BASE[lc], LEN_XB[lc]);
				var dc = 29;
				for (var q2 = 0; q2 < 30; q2++)
					if (q2 === 29 || DST_BASE[q2 + 1] > bestDist) {
						dc = q2;
						break;
					}
				bw.whuff(dc, 5);
				if (DST_XB[dc]) bw.wb(bestDist - DST_BASE[dc], DST_XB[dc]);
				var end = Math.min(i + bestLen, n - 2);
				for (var m = i; m < end; m++) {
					var hm = h3(m);
					prev[m] = head[hm];
					head[hm] = m;
				}
				i += bestLen;
			} else {
				fixedLit(data[i], bw);
				if (i + 2 < n) {
					var h1 = h3(i);
					prev[i] = head[h1];
					head[h1] = i;
				}
				i++;
			}
		}
		fixedLit(256, bw);
		return bw.end();
	}
	function zlibWrap(raw, data) {
		var out = new Uint8Array(2 + raw.length + 4);
		out[0] = 0x78;
		out[1] = 0x01;
		out.set(raw, 2);
		var ad = adler32(data),
			o = 2 + raw.length;
		out[o] = (ad >>> 24) & 255;
		out[o + 1] = (ad >>> 16) & 255;
		out[o + 2] = (ad >>> 8) & 255;
		out[o + 3] = ad & 255;
		return out;
	}
	function pngChunk(type, payload) {
		var out = new Uint8Array(12 + payload.length),
			dv = new DataView(out.buffer);
		dv.setUint32(0, payload.length);
		for (var i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
		out.set(payload, 8);
		var crcBuf = new Uint8Array(4 + payload.length);
		for (var j = 0; j < 4; j++) crcBuf[j] = type.charCodeAt(j);
		crcBuf.set(payload, 4);
		dv.setUint32(8 + payload.length, crc32(crcBuf, 0, crcBuf.length));
		return out;
	}
	Tex.prototype.toPNG = function () {
		var w = this.w,
			h = this.h,
			d = this.data;
		var opaque = true;
		for (var i = 3; i < d.length; i += 4)
			if (d[i] < 0.999) {
				opaque = false;
				break;
			}
		var ch = opaque ? 3 : 4,
			row = w * ch + 1,
			raw = new Uint8Array(row * h);
		for (var y = 0; y < h; y++) {
			raw[y * row] = 0;
			for (var x = 0; x < w; x++) {
				var si = (y * w + x) * 4,
					di = y * row + 1 + x * ch;
				raw[di] = clamp(Math.round(d[si] * 255), 0, 255);
				raw[di + 1] = clamp(Math.round(d[si + 1] * 255), 0, 255);
				raw[di + 2] = clamp(Math.round(d[si + 2] * 255), 0, 255);
				if (ch === 4) raw[di + 3] = clamp(Math.round(d[si + 3] * 255), 0, 255);
			}
		}
		var idat = zlibWrap(deflateFixed(raw), raw);
		var ihdr = new Uint8Array(13),
			dv = new DataView(ihdr.buffer);
		dv.setUint32(0, w);
		dv.setUint32(4, h);
		ihdr[8] = 8;
		ihdr[9] = opaque ? 2 : 6;
		ihdr[10] = 0;
		ihdr[11] = 0;
		ihdr[12] = 0;
		var sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
		var c1 = pngChunk('IHDR', ihdr),
			c2 = pngChunk('IDAT', idat),
			c3 = pngChunk('IEND', new Uint8Array(0));
		var out = new Uint8Array(sig.length + c1.length + c2.length + c3.length),
			o = 0;
		out.set(sig, o);
		o += sig.length;
		out.set(c1, o);
		o += c1.length;
		out.set(c2, o);
		o += c2.length;
		out.set(c3, o);
		return out;
	};

	function Material(opt) {
		opt = opt || {};
		this.__isMat = true;
		this.name = opt.name || 'material';
		this.baseColor = opt.baseColor != null ? parseColor(opt.baseColor) : [1, 1, 1, 1];
		if (isNum(opt.alpha)) this.baseColor[3] = opt.alpha;
		this.baseColorMap = opt.baseColorMap || opt.albedoMap || null;
		this.metallic = isNum(opt.metallic) ? clamp(opt.metallic, 0, 1) : 0;
		this.roughness = isNum(opt.roughness) ? clamp(opt.roughness, 0, 1) : 0.8;
		this.metallicRoughnessMap = opt.metallicRoughnessMap || null;
		if (!this.metallicRoughnessMap && (opt.metallicMap || opt.roughnessMap))
			this.metallicRoughnessMap = packMR(
				opt.metallicMap || this.metallic,
				opt.roughnessMap || this.roughness,
			);
		this.normalMap = opt.normalMap || null;
		this.normalScale = isNum(opt.normalScale) ? opt.normalScale : 1;
		this.emissive = opt.emissive != null ? parseColor(opt.emissive) : [0, 0, 0, 1];
		this.emissiveMap = opt.emissiveMap || null;
		this.occlusionMap = opt.occlusionMap || null;
		this.alphaMode = opt.alphaMode || (this.baseColor[3] < 0.999 ? 'BLEND' : 'OPAQUE');
		this.alphaCutoff = isNum(opt.alphaCutoff) ? opt.alphaCutoff : 0.5;
		this.doubleSided = !!opt.doubleSided;
		if (this.baseColorMap && !this.baseColorMap.__isTex)
			throw new Error('material "' + this.name + '": baseColorMap precisa ser F.tex(...)');
		if (this.normalMap && !this.normalMap.__isTex)
			throw new Error(
				'material "' +
					this.name +
					'": normalMap precisa ser F.tex(...) (use heightTex.normalFromHeight(forca))',
			);
	}

	function Model(opt) {
		opt = opt || {};
		this.__isModel = true;
		this.name = opt.name || 'asset';
		this.parts = [];
		this.skeleton = null;
		this.clips = [];
	}
	Model.prototype.add = function (mesh, material, opt) {
		opt = opt || {};
		if (!mesh || !mesh.__isMesh)
			throw new Error(
				'model.add: primeiro argumento precisa ser uma malha (F.box, F.lathe, csg, ...)',
			);
		if (material && !material.__isMat) material = new Material(material);
		this.parts.push({
			mesh: mesh,
			material: material || new Material({ name: 'padrao' }),
			name: opt.name || mesh.name,
		});
		return this;
	};
	Model.prototype.bbox = function () {
		var mn = [1 / 0, 1 / 0, 1 / 0],
			mx = [-1 / 0, -1 / 0, -1 / 0];
		for (var i = 0; i < this.parts.length; i++) {
			var b = this.parts[i].mesh.bbox();
			for (var k = 0; k < 3; k++) {
				if (b.min[k] < mn[k]) mn[k] = b.min[k];
				if (b.max[k] > mx[k]) mx[k] = b.max[k];
			}
		}
		if (!this.parts.length) {
			mn = [0, 0, 0];
			mx = [0, 0, 0];
		}
		return { min: mn, max: mx };
	};
	Model.prototype.dims = function () {
		var b = this.bbox();
		return vsub(b.max, b.min);
	};
	Model.prototype.triCount = function () {
		var t = 0;
		for (var i = 0; i < this.parts.length; i++) t += this.parts[i].mesh.triCount();
		return t;
	};
	Model.prototype.translate = function (x, y, z) {
		for (var i = 0; i < this.parts.length; i++) this.parts[i].mesh.translate(x, y, z);
		return this;
	};
	Model.prototype.rotateY = function (d) {
		for (var i = 0; i < this.parts.length; i++) this.parts[i].mesh.rotateY(d);
		return this;
	};
	Model.prototype.scale = function (s) {
		for (var i = 0; i < this.parts.length; i++) this.parts[i].mesh.scale(s);
		return this;
	};
	Model.prototype.alignBottom = function (y) {
		var b = this.bbox();
		return this.translate(0, (y || 0) - b.min[1], 0);
	};
	Model.prototype.center = function (axes) {
		axes = axes || 'xz';
		var b = this.bbox();
		var c = vmul(vadd(b.min, b.max), 0.5);
		return this.translate(
			axes.indexOf('x') >= 0 ? -c[0] : 0,
			axes.indexOf('y') >= 0 ? -c[1] : 0,
			axes.indexOf('z') >= 0 ? -c[2] : 0,
		);
	};

	function qmul(a, b) {
		return [
			a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
			a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
			a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
			a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
		];
	}
	function quatEuler(gx, gy, gz) {
		var hx = ((+gx || 0) * Math.PI) / 360,
			hy = ((+gy || 0) * Math.PI) / 360,
			hz = ((+gz || 0) * Math.PI) / 360;
		var qx = [Math.sin(hx), 0, 0, Math.cos(hx)],
			qy = [0, Math.sin(hy), 0, Math.cos(hy)],
			qz = [0, 0, Math.sin(hz), Math.cos(hz)];
		return qmul(qmul(qx, qy), qz);
	}
	function distSeg(pnt, a, b) {
		var ab = vsub(b, a),
			den = vdot(ab, ab),
			t = den > 1e-12 ? vdot(vsub(pnt, a), ab) / den : 0;
		t = clamp(t, 0, 1);
		return vlen(vsub(pnt, vadd(a, vmul(ab, t))));
	}

	function Skeleton(opt) {
		opt = opt || {};
		this.__isSkel = true;
		this.name = opt.name || 'rig';
		this.bones = [];
		this.index = {};
		if (Array.isArray(opt.bones))
			for (var i = 0; i < opt.bones.length; i++) this.addBone(opt.bones[i]);
	}
	Skeleton.prototype.addBone = function (b) {
		if (typeof b === 'string')
			b = {
				name: arguments[0],
				parent: arguments[1] || null,
				head: arguments[2],
				tail: arguments[3],
			};
		b = b || {};
		if (!b.name) throw new Error('skeleton.addBone: informe name');
		if (this.index[b.name] != null) throw new Error('skeleton: osso duplicado "' + b.name + '"');
		if (b.parent && this.index[b.parent] == null)
			throw new Error(
				'skeleton: parent "' + b.parent + '" ainda nao existe (declare o pai antes do filho)',
			);
		var head = b.head || [0, 0, 0],
			tail = b.tail || [head[0], head[1] + 0.1, head[2]];
		this.index[b.name] = this.bones.length;
		this.bones.push({
			name: String(b.name),
			parent: b.parent || null,
			head: [+head[0] || 0, +head[1] || 0, +head[2] || 0],
			tail: [+tail[0] || 0, +tail[1] || 0, +tail[2] || 0],
		});
		return this;
	};
	Skeleton.prototype.bone = function (n) {
		var i = this.index[n];
		return i == null ? null : this.bones[i];
	};
	Skeleton.prototype.chain = function (prefixo, parent, pontos) {
		if (!Array.isArray(pontos) || pontos.length < 2)
			throw new Error('skeleton.chain: pontos = [[x,y,z],...] com 2+ itens');
		for (var i = 0; i < pontos.length - 1; i++)
			this.addBone({
				name: prefixo + (i + 1),
				parent: i === 0 ? parent || null : prefixo + i,
				head: pontos[i],
				tail: pontos[i + 1],
			});
		return this;
	};

	function skeletonHumanoid(opt) {
		opt = opt || {};
		var h = isNum(opt.height) ? opt.height : 1.8,
			e = h / 1.8;
		function m(a) {
			return [a[0] * e, a[1] * e, a[2] * e];
		}
		var sk = new Skeleton({ name: opt.name || 'humanoide' });
		sk.addBone({ name: 'quadril', head: m([0, 0.95, 0]), tail: m([0, 1.05, 0]) });
		sk.addBone({ name: 'coluna', parent: 'quadril', head: m([0, 1.05, 0]), tail: m([0, 1.25, 0]) });
		sk.addBone({ name: 'peito', parent: 'coluna', head: m([0, 1.25, 0]), tail: m([0, 1.45, 0]) });
		sk.addBone({ name: 'pescoco', parent: 'peito', head: m([0, 1.45, 0]), tail: m([0, 1.55, 0]) });
		sk.addBone({ name: 'cabeca', parent: 'pescoco', head: m([0, 1.55, 0]), tail: m([0, 1.78, 0]) });
		['L', 'R'].forEach(function (sd) {
			var x = sd === 'L' ? 1 : -1;
			sk.addBone({
				name: 'ombro.' + sd,
				parent: 'peito',
				head: m([0.06 * x, 1.42, 0]),
				tail: m([0.19 * x, 1.42, 0]),
			});
			sk.addBone({
				name: 'braco.' + sd,
				parent: 'ombro.' + sd,
				head: m([0.19 * x, 1.42, 0]),
				tail: m([0.45 * x, 1.42, 0]),
			});
			sk.addBone({
				name: 'antebraco.' + sd,
				parent: 'braco.' + sd,
				head: m([0.45 * x, 1.42, 0]),
				tail: m([0.7 * x, 1.42, 0]),
			});
			sk.addBone({
				name: 'mao.' + sd,
				parent: 'antebraco.' + sd,
				head: m([0.7 * x, 1.42, 0]),
				tail: m([0.82 * x, 1.42, 0]),
			});
			sk.addBone({
				name: 'coxa.' + sd,
				parent: 'quadril',
				head: m([0.09 * x, 0.95, 0]),
				tail: m([0.09 * x, 0.5, 0]),
			});
			sk.addBone({
				name: 'canela.' + sd,
				parent: 'coxa.' + sd,
				head: m([0.09 * x, 0.5, 0]),
				tail: m([0.09 * x, 0.08, 0]),
			});
			sk.addBone({
				name: 'pe.' + sd,
				parent: 'canela.' + sd,
				head: m([0.09 * x, 0.08, 0]),
				tail: m([0.09 * x, 0.02, 0.14]),
			});
		});
		return sk;
	}

	function AnimClip(name, opt) {
		opt = opt || {};
		this.__isClip = true;
		this.name = String(name || 'clip');
		this.fps = isNum(opt.fps) ? opt.fps : 24;
		this.loop = opt.loop !== false;
		this.step = !!opt.step;
		this.tracks = {};
	}
	AnimClip.prototype.key = function (osso, t, pose) {
		pose = pose || {};
		osso = String(osso);
		t = Math.max(0, +t || 0);
		var self = this;
		function poe(path, v) {
			var k = osso + '|' + path,
				tr = self.tracks[k] || (self.tracks[k] = { bone: osso, path: path, keys: [] });
			for (var i = 0; i < tr.keys.length; i++)
				if (Math.abs(tr.keys[i].t - t) < 1e-6) {
					tr.keys[i].v = v;
					return;
				}
			tr.keys.push({ t: t, v: v });
		}
		if (pose.quat)
			poe('rotation', [
				+pose.quat[0] || 0,
				+pose.quat[1] || 0,
				+pose.quat[2] || 0,
				+pose.quat[3] || 1,
			]);
		else if (pose.rot) poe('rotation', quatEuler(pose.rot[0], pose.rot[1], pose.rot[2]));
		if (pose.pos) poe('translation', [+pose.pos[0] || 0, +pose.pos[1] || 0, +pose.pos[2] || 0]);
		if (pose.scl != null) {
			var sc = pose.scl;
			if (isNum(sc)) sc = [sc, sc, sc];
			poe('scale', [+sc[0] || 1, +sc[1] || 1, +sc[2] || 1]);
		}
		return this;
	};
	AnimClip.prototype.duration = function () {
		var d = 0,
			tk = this.tracks;
		Object.keys(tk).forEach(function (k) {
			tk[k].keys.forEach(function (kf) {
				if (kf.t > d) d = kf.t;
			});
		});
		return d;
	};

	Model.prototype.bindSkeleton = function (skel, opt) {
		opt = opt || {};
		if (!skel || !skel.__isSkel)
			throw new Error('bindSkeleton: passe um F.skeleton(...) ou F.skeletonHumanoid(...)');
		if (!skel.bones.length) throw new Error('bindSkeleton: esqueleto sem ossos');
		if (!this.parts.length)
			throw new Error('bindSkeleton: adicione as malhas (model.add) ANTES de fazer o bind');
		this.skeleton = skel;
		var maxInf = Math.max(1, Math.min(4, opt.maxInfluences | 0 || 4));
		var fall = isNum(opt.falloff) ? Math.max(0.5, opt.falloff) : 2;
		var apenas = opt.bones || null;
		for (var pi = 0; pi < this.parts.length; pi++) {
			var mesh = this.parts[pi].mesh,
				vc = mesh.vertCount(),
				pos = mesh.pos;
			var J = new Array(vc * 4).fill(0),
				W = new Array(vc * 4).fill(0);
			for (var v = 0; v < vc; v++) {
				var pt = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]],
					cand = [];
				for (var b = 0; b < skel.bones.length; b++) {
					var bn = skel.bones[b];
					if (apenas && apenas.indexOf(bn.name) < 0) continue;
					var d = distSeg(pt, bn.head, bn.tail);
					cand.push([b, 1 / Math.pow(d + 1e-4, fall)]);
				}
				cand.sort(function (a, c) {
					return c[1] - a[1];
				});
				cand = cand.slice(0, maxInf);
				var soma = 0;
				for (var k = 0; k < cand.length; k++) soma += cand[k][1];
				for (var k2 = 0; k2 < cand.length; k2++) {
					J[v * 4 + k2] = cand[k2][0];
					W[v * 4 + k2] = cand[k2][1] / (soma || 1);
				}
			}
			mesh.joints = J;
			mesh.weights = W;
		}
		return this;
	};

	Model.prototype.setWeights = function (nomeOsso, fn, opt) {
		opt = opt || {};
		if (!this.skeleton) throw new Error('setWeights: chame model.bindSkeleton(skel) antes');
		var bi = this.skeleton.index[nomeOsso];
		if (bi == null) throw new Error('setWeights: osso "' + nomeOsso + '" nao existe no esqueleto');
		if (typeof fn !== 'function') throw new Error('setWeights: passe fn(x,y,z)=>0..1|null');
		for (var pi = 0; pi < this.parts.length; pi++) {
			var mesh = this.parts[pi].mesh;
			if (!mesh.joints) continue;
			var vc = mesh.vertCount(),
				pos = mesh.pos,
				J = mesh.joints,
				W = mesh.weights;
			for (var v = 0; v < vc; v++) {
				var w = fn(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
				if (w == null) continue;
				w = clamp(+w || 0, 0, 1);
				var infl = {},
					k;
				for (k = 0; k < 4; k++)
					if (W[v * 4 + k] > 0) infl[J[v * 4 + k]] = (infl[J[v * 4 + k]] || 0) + W[v * 4 + k];
				var outros = 0;
				Object.keys(infl).forEach(function (kk) {
					if (+kk !== bi) outros += infl[kk];
				});
				var esc = outros > 0 ? (1 - w) / outros : 0;
				Object.keys(infl).forEach(function (kk) {
					if (+kk !== bi) infl[kk] *= esc;
				});
				infl[bi] = outros > 0 || w > 0 ? w : 1;
				if (outros === 0) infl[bi] = 1;
				var lista = Object.keys(infl)
					.map(function (kk) {
						return [+kk, infl[kk]];
					})
					.filter(function (par) {
						return par[1] > 1e-4;
					});
				lista.sort(function (a, c) {
					return c[1] - a[1];
				});
				lista = lista.slice(0, 4);
				var soma = 0;
				lista.forEach(function (par) {
					soma += par[1];
				});
				for (k = 0; k < 4; k++) {
					J[v * 4 + k] = k < lista.length ? lista[k][0] : 0;
					W[v * 4 + k] = k < lista.length ? lista[k][1] / (soma || 1) : 0;
				}
			}
		}
		return this;
	};

	Model.prototype.addClip = function (clip) {
		if (!clip || !clip.__isClip) throw new Error('addClip: passe um F.clip(nome, {fps,loop})');
		this.clips.push(clip);
		return this;
	};

	Model.prototype.softbody = function (opt) {
		opt = opt || {};
		var nomes = opt.parts
			? Array.isArray(opt.parts)
				? opt.parts
				: [opt.parts]
			: opt.part
				? [opt.part]
				: null;
		var stiff = isNum(opt.stiffness) ? clamp(opt.stiffness, 0, 1) : 0.5;
		var damp = isNum(opt.damping) ? clamp(opt.damping, 0, 1) : 0.05;
		var mass = isNum(opt.mass) ? opt.mass : 1;
		var iters = isNum(opt.iterations) ? Math.max(1, opt.iterations | 0) : 6;
		var softFn = typeof opt.soft === 'function' ? opt.soft : null;
		var softVal = isNum(opt.soft) ? clamp(opt.soft, 0, 1) : 1;
		var pinFn = typeof opt.pin === 'function' ? opt.pin : null;
		var marcou = 0;
		for (var pi = 0; pi < this.parts.length; pi++) {
			var part = this.parts[pi];
			if (nomes && nomes.indexOf(part.name) < 0) continue;
			var mesh = part.mesh,
				vc = mesh.vertCount(),
				p = mesh.pos;
			var soft = new Array(vc),
				pins = [];
			for (var v = 0; v < vc; v++) {
				var x = p[v * 3],
					y = p[v * 3 + 1],
					z = p[v * 3 + 2];
				var sv = softFn ? clamp(+softFn(x, y, z) || 0, 0, 1) : softVal;
				if (pinFn && pinFn(x, y, z)) {
					sv = 0;
					pins.push(v);
				}
				soft[v] = sv;
			}
			var eMap = new Map(),
				ix = mesh.idx,
				opp = new Map();
			var liga = function (a, b) {
				if (a === b) return;
				var k = a < b ? a + '_' + b : b + '_' + a;
				if (!eMap.has(k)) eMap.set(k, [a, b]);
			};
			for (var f = 0; f < ix.length; f += 3) {
				var A = ix[f],
					B = ix[f + 1],
					C = ix[f + 2];
				liga(A, B);
				liga(B, C);
				liga(C, A);
				if (opt.bend) {
					var trios = [
						[A, B, C],
						[B, C, A],
						[C, A, B],
					];
					for (var q = 0; q < 3; q++) {
						var tr = trios[q],
							k2 = tr[0] < tr[1] ? tr[0] + '_' + tr[1] : tr[1] + '_' + tr[0];
						if (opp.has(k2)) liga(opp.get(k2), tr[2]);
						else opp.set(k2, tr[2]);
					}
				}
			}
			var links = [];
			eMap.forEach(function (par) {
				var a = par[0],
					b = par[1];
				links.push(
					a,
					b,
					+Math.hypot(
						p[a * 3] - p[b * 3],
						p[a * 3 + 1] - p[b * 3 + 1],
						p[a * 3 + 2] - p[b * 3 + 2],
					).toFixed(5),
				);
			});
			mesh.softness = soft;
			mesh.__softMeta = {
				version: 1,
				params: { stiffness: stiff, damping: damp, mass: mass, iterations: iters },
				pins: pins,
				links: links,
				counts: { verts: vc, links: links.length / 3 },
			};
			marcou++;
		}
		if (!marcou)
			throw new Error(
				'softbody: nenhuma parte marcada' +
					(nomes ? ' - confira os nomes em parts' : ' - adicione malhas (model.add) antes'),
			);
		return this;
	};

	function pad4(n) {
		return (4 - (n % 4)) % 4;
	}
	function toGLB(model) {
		if (model && model.__isMesh) {
			var mm = new Model({ name: model.name });
			mm.add(model);
			model = mm;
		}
		if (!model || !model.__isModel)
			throw new Error('toGLB: passe um F.model() com partes (ou uma malha)');
		if (!model.parts.length)
			throw new Error('toGLB: o modelo esta vazio (use model.add(malha, material))');
		var json = {
			asset: { version: '2.0', generator: 'AuroraForge ' + VERSION },
			scene: 0,
			scenes: [{ nodes: [] }],
			nodes: [],
			meshes: [],
			materials: [],
			accessors: [],
			bufferViews: [],
			buffers: [],
			samplers: [],
			textures: [],
			images: [],
		};
		var bin = [],
			binLen = 0;
		function pushBuf(bytes, align, target) {
			var padA = align ? (align - (binLen % align)) % align : 0;
			if (padA) {
				bin.push(new Uint8Array(padA));
				binLen += padA;
			}
			var view = { buffer: 0, byteOffset: binLen, byteLength: bytes.length };
			if (target) view.target = target;
			json.bufferViews.push(view);
			bin.push(bytes);
			binLen += bytes.length;
			return json.bufferViews.length - 1;
		}
		var texCache = new Map();
		function texIndex(tex, label) {
			if (texCache.has(tex)) return texCache.get(tex);
			var png = tex.toPNG();
			var bv = pushBuf(png, 4, null);
			json.images.push({
				bufferView: bv,
				mimeType: 'image/png',
				name: label || 'tex' + json.images.length,
			});
			json.textures.push({ sampler: 0, source: json.images.length - 1 });
			var ti = json.textures.length - 1;
			texCache.set(tex, ti);
			return ti;
		}
		json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
		var matCache = new Map();
		function matIndex(mat) {
			if (matCache.has(mat)) return matCache.get(mat);
			var m = { name: mat.name, pbrMetallicRoughness: {} };
			var pbr = m.pbrMetallicRoughness;
			pbr.baseColorFactor = mat.baseColorMap ? [1, 1, 1, 1] : mat.baseColor.slice();
			if (mat.baseColorMap)
				pbr.baseColorTexture = { index: texIndex(mat.baseColorMap, mat.name + '_baseColor') };
			pbr.metallicFactor = mat.metallicRoughnessMap ? 1 : mat.metallic;
			pbr.roughnessFactor = mat.metallicRoughnessMap ? 1 : mat.roughness;
			if (mat.metallicRoughnessMap)
				pbr.metallicRoughnessTexture = {
					index: texIndex(mat.metallicRoughnessMap, mat.name + '_mr'),
				};
			if (mat.normalMap) {
				m.normalTexture = { index: texIndex(mat.normalMap, mat.name + '_normal') };
				if (mat.normalScale !== 1) m.normalTexture.scale = mat.normalScale;
			}
			if (mat.occlusionMap)
				m.occlusionTexture = { index: texIndex(mat.occlusionMap, mat.name + '_ao') };
			if (mat.emissiveMap) {
				m.emissiveTexture = { index: texIndex(mat.emissiveMap, mat.name + '_emissive') };
				m.emissiveFactor = [1, 1, 1];
			} else if (mat.emissive[0] + mat.emissive[1] + mat.emissive[2] > 0)
				m.emissiveFactor = [mat.emissive[0], mat.emissive[1], mat.emissive[2]];
			if (mat.alphaMode !== 'OPAQUE') {
				m.alphaMode = mat.alphaMode;
				if (mat.alphaMode === 'MASK') m.alphaCutoff = mat.alphaCutoff;
			}
			if (mat.doubleSided) m.doubleSided = true;
			json.materials.push(m);
			var mi = json.materials.length - 1;
			matCache.set(mat, mi);
			return mi;
		}
		function accessor(view, type, compType, count, min, max) {
			var a = { bufferView: view, componentType: compType, count: count, type: type };
			if (min) a.min = min;
			if (max) a.max = max;
			json.accessors.push(a);
			return json.accessors.length - 1;
		}
		var skinNodes = [];
		for (var pi = 0; pi < model.parts.length; pi++) {
			var part = model.parts[pi],
				mesh = part.mesh;
			if (!mesh.idx.length) continue;
			if (!mesh.nrm) mesh.computeNormals({ angleDeg: 60 });
			var hasTex = !!(
				part.material.baseColorMap ||
				part.material.normalMap ||
				part.material.metallicRoughnessMap ||
				part.material.emissiveMap ||
				part.material.occlusionMap
			);
			if (!mesh.uv && hasTex) mesh.uvBox();
			var vc = mesh.vertCount();
			var fpos = new Float32Array(mesh.pos),
				fnrm = new Float32Array(mesh.nrm);
			for (var nn = 0; nn < fnrm.length; nn += 3) {
				var l = Math.hypot(fnrm[nn], fnrm[nn + 1], fnrm[nn + 2]);
				if (!(l > 1e-6)) {
					fnrm[nn] = 0;
					fnrm[nn + 1] = 1;
					fnrm[nn + 2] = 0;
				} else {
					fnrm[nn] /= l;
					fnrm[nn + 1] /= l;
					fnrm[nn + 2] /= l;
				}
			}
			var mn = [1 / 0, 1 / 0, 1 / 0],
				mx = [-1 / 0, -1 / 0, -1 / 0];
			for (var v = 0; v < vc; v++)
				for (var k = 0; k < 3; k++) {
					var val = fpos[v * 3 + k];
					if (val < mn[k]) mn[k] = val;
					if (val > mx[k]) mx[k] = val;
				}
			var pv = pushBuf(new Uint8Array(fpos.buffer, fpos.byteOffset, fpos.byteLength), 4, 34962);
			var pa = accessor(pv, 'VEC3', 5126, vc, mn, mx);
			var nv = pushBuf(new Uint8Array(fnrm.buffer, fnrm.byteOffset, fnrm.byteLength), 4, 34962);
			var na = accessor(nv, 'VEC3', 5126, vc);
			var attrs = { POSITION: pa, NORMAL: na };
			if (mesh.uv) {
				var fuv = new Float32Array(vc * 2);
				for (var u = 0; u < vc; u++) {
					fuv[u * 2] = mesh.uv[u * 2];
					fuv[u * 2 + 1] = 1 - mesh.uv[u * 2 + 1];
				}
				var uvv = pushBuf(new Uint8Array(fuv.buffer, fuv.byteOffset, fuv.byteLength), 4, 34962);
				attrs.TEXCOORD_0 = accessor(uvv, 'VEC2', 5126, vc);
			}
			if (model.skeleton && mesh.joints && mesh.weights) {
				var ju = new Uint16Array(mesh.joints);
				var jv = pushBuf(new Uint8Array(ju.buffer, ju.byteOffset, ju.byteLength), 4, 34962);
				attrs.JOINTS_0 = accessor(jv, 'VEC4', 5123, vc);
				var wf = new Float32Array(mesh.weights);
				var wv = pushBuf(new Uint8Array(wf.buffer, wf.byteOffset, wf.byteLength), 4, 34962);
				attrs.WEIGHTS_0 = accessor(wv, 'VEC4', 5126, vc);
			}
			if (mesh.softness) {
				var sf = new Float32Array(mesh.softness);
				var sv2 = pushBuf(new Uint8Array(sf.buffer, sf.byteOffset, sf.byteLength), 4, 34962);
				attrs._SOFTNESS = accessor(sv2, 'SCALAR', 5126, vc);
			}
			var idxArr, compT;
			if (vc <= 65535) {
				idxArr = new Uint16Array(mesh.idx);
				compT = 5123;
			} else {
				idxArr = new Uint32Array(mesh.idx);
				compT = 5125;
			}
			var iv = pushBuf(
				new Uint8Array(idxArr.buffer, idxArr.byteOffset, idxArr.byteLength),
				4,
				34963,
			);
			var ia = accessor(iv, 'SCALAR', compT, mesh.idx.length);
			var meshDef = {
				name: part.name,
				primitives: [
					{ attributes: attrs, indices: ia, material: matIndex(part.material), mode: 4 },
				],
			};
			if (mesh.__softMeta) meshDef.extras = { synapseSoftbody: mesh.__softMeta };
			json.meshes.push(meshDef);
			json.nodes.push({ mesh: json.meshes.length - 1, name: part.name });
			if (model.skeleton && mesh.joints) skinNodes.push(json.nodes.length - 1);
			json.scenes[0].nodes.push(json.nodes.length - 1);
		}
		if (model.skeleton && skinNodes.length) {
			var sk = model.skeleton,
				baseN = json.nodes.length,
				idxNo = {};
			for (var bA = 0; bA < sk.bones.length; bA++) idxNo[sk.bones[bA].name] = baseN + bA;
			for (var bB = 0; bB < sk.bones.length; bB++) {
				var bo = sk.bones[bB];
				var ph = bo.parent ? sk.bones[sk.index[bo.parent]].head : [0, 0, 0];
				json.nodes.push({
					name: bo.name,
					translation: [bo.head[0] - ph[0], bo.head[1] - ph[1], bo.head[2] - ph[2]],
				});
			}
			for (var bC = 0; bC < sk.bones.length; bC++) {
				var bo2 = sk.bones[bC];
				if (bo2.parent) {
					var pn = json.nodes[idxNo[bo2.parent]];
					(pn.children || (pn.children = [])).push(idxNo[bo2.name]);
				} else json.scenes[0].nodes.push(idxNo[bo2.name]);
			}
			var ibm = new Float32Array(sk.bones.length * 16);
			for (var bD = 0; bD < sk.bones.length; bD++) {
				var o16 = bD * 16,
					hd = sk.bones[bD].head;
				ibm[o16] = 1;
				ibm[o16 + 5] = 1;
				ibm[o16 + 10] = 1;
				ibm[o16 + 15] = 1;
				ibm[o16 + 12] = -hd[0];
				ibm[o16 + 13] = -hd[1];
				ibm[o16 + 14] = -hd[2];
			}
			var ibmV = pushBuf(new Uint8Array(ibm.buffer, ibm.byteOffset, ibm.byteLength), 4, null);
			var ibmA = accessor(ibmV, 'MAT4', 5126, sk.bones.length);
			json.skins = [
				{
					name: sk.name,
					inverseBindMatrices: ibmA,
					joints: sk.bones.map(function (b) {
						return idxNo[b.name];
					}),
				},
			];
			for (var sN = 0; sN < skinNodes.length; sN++) json.nodes[skinNodes[sN]].skin = 0;
			if (model.clips && model.clips.length) {
				json.animations = [];
				for (var ci = 0; ci < model.clips.length; ci++) {
					var clip = model.clips[ci];
					var anim = { name: clip.name, channels: [], samplers: [] };
					var chaves = Object.keys(clip.tracks);
					for (var ti = 0; ti < chaves.length; ti++) {
						var trk = clip.tracks[chaves[ti]];
						if (idxNo[trk.bone] == null) continue;
						if (!trk.keys.length) continue;
						var keys = trk.keys.slice().sort(function (a, b) {
							return a.t - b.t;
						});
						var comp = trk.path === 'rotation' ? 4 : 3;
						var times = new Float32Array(keys.length),
							vals = new Float32Array(keys.length * comp);
						var rest = null;
						if (trk.path === 'translation') {
							var boT = sk.bones[sk.index[trk.bone]],
								phT = boT.parent ? sk.bones[sk.index[boT.parent]].head : [0, 0, 0];
							rest = [boT.head[0] - phT[0], boT.head[1] - phT[1], boT.head[2] - phT[2]];
						}
						for (var ki = 0; ki < keys.length; ki++) {
							times[ki] = keys[ki].t;
							for (var cj = 0; cj < comp; cj++)
								vals[ki * comp + cj] = keys[ki].v[cj] + (rest ? rest[cj] : 0);
						}
						var tV = pushBuf(
							new Uint8Array(times.buffer, times.byteOffset, times.byteLength),
							4,
							null,
						);
						var tA = accessor(
							tV,
							'SCALAR',
							5126,
							keys.length,
							[times[0]],
							[times[keys.length - 1]],
						);
						var vV = pushBuf(
							new Uint8Array(vals.buffer, vals.byteOffset, vals.byteLength),
							4,
							null,
						);
						var vA = accessor(vV, comp === 4 ? 'VEC4' : 'VEC3', 5126, keys.length);
						anim.samplers.push({
							input: tA,
							output: vA,
							interpolation: clip.step ? 'STEP' : 'LINEAR',
						});
						anim.channels.push({
							sampler: anim.samplers.length - 1,
							target: { node: idxNo[trk.bone], path: trk.path },
						});
					}
					if (anim.channels.length) json.animations.push(anim);
				}
			}
		}
		if (!json.meshes.length) throw new Error('toGLB: nenhuma parte com triangulos');
		if (!json.images.length) {
			delete json.samplers;
			delete json.textures;
			delete json.images;
		}
		var binAll = new Uint8Array(binLen + pad4(binLen)),
			off = 0;
		for (var bI = 0; bI < bin.length; bI++) {
			binAll.set(bin[bI], off);
			off += bin[bI].length;
		}
		json.buffers.push({ byteLength: binAll.length });
		var jsonBytes = new TextEncoder().encode(JSON.stringify(json));
		var jsonPad = pad4(jsonBytes.length);
		var total = 12 + 8 + jsonBytes.length + jsonPad + 8 + binAll.length;
		var glb = new Uint8Array(total),
			dv = new DataView(glb.buffer);
		dv.setUint32(0, 0x46546c67, true);
		dv.setUint32(4, 2, true);
		dv.setUint32(8, total, true);
		dv.setUint32(12, jsonBytes.length + jsonPad, true);
		dv.setUint32(16, 0x4e4f534a, true);
		glb.set(jsonBytes, 20);
		for (var sp = 0; sp < jsonPad; sp++) glb[20 + jsonBytes.length + sp] = 0x20;
		var binOff = 20 + jsonBytes.length + jsonPad;
		dv.setUint32(binOff, binAll.length, true);
		dv.setUint32(binOff + 4, 0x004e4942, true);
		glb.set(binAll, binOff + 8);
		return glb;
	}

	function validateMesh(mesh) {
		var errs = [],
			warns = [],
			p = mesh.pos,
			ix = mesh.idx;
		for (var i = 0; i < p.length; i++)
			if (!isFinite(p[i])) {
				errs.push('posicoes com NaN/Infinity');
				break;
			}
		var deg = 0;
		for (var f = 0; f < ix.length; f += 3) {
			var a = ix[f] * 3,
				b = ix[f + 1] * 3,
				c = ix[f + 2] * 3;
			var ar =
				vlen(
					vcross(
						[p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]],
						[p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]],
					),
				) / 2;
			if (ar < 1e-12) deg++;
		}
		if (deg > 0)
			warns.push(deg + ' triangulo(s) degenerado(s) (area ~0) - use weld() ou revise a geometria');
		var vkey = new Array((p.length / 3) | 0);
		for (var vq = 0; vq < vkey.length; vq++)
			vkey[vq] =
				Math.round(p[vq * 3] * 1e5) +
				'_' +
				Math.round(p[vq * 3 + 1] * 1e5) +
				'_' +
				Math.round(p[vq * 3 + 2] * 1e5);
		var edges = new Map();
		for (var f2 = 0; f2 < ix.length; f2 += 3)
			for (var k = 0; k < 3; k++) {
				var e1 = vkey[ix[f2 + k]],
					e2 = vkey[ix[f2 + ((k + 1) % 3)]];
				if (e1 === e2) continue;
				var key = e1 < e2 ? e1 + '|' + e2 : e2 + '|' + e1;
				edges.set(key, (edges.get(key) || 0) + 1);
			}
		var open = 0,
			nonMan = 0;
		edges.forEach(function (cnt) {
			if (cnt === 1) open++;
			else if (cnt > 2) nonMan++;
		});
		if (mesh.__fromCsg) {
			if (open > 0 || nonMan > 0)
				warns.push(
					'pos-CSG: ' +
						open +
						' borda(s) e ' +
						nonMan +
						' nao-manifold por T-junctions - esperado, sem buracos visiveis; so investigue se a ficha mostrar falhas',
				);
		} else {
			if (nonMan > 0) warns.push(nonMan + ' aresta(s) nao-manifold (3+ faces na mesma aresta)');
			if (open > 0)
				warns.push(
					open +
						' aresta(s) de borda aberta' +
						(open > 8
							? ' - se o asset deveria ser solido, feche a malha'
							: ' (ok se for plano/folha)'),
				);
		}
		var vol = 0;
		for (var f3 = 0; f3 < ix.length; f3 += 3) {
			var A = [p[ix[f3] * 3], p[ix[f3] * 3 + 1], p[ix[f3] * 3 + 2]],
				B = [p[ix[f3 + 1] * 3], p[ix[f3 + 1] * 3 + 1], p[ix[f3 + 1] * 3 + 2]],
				C = [p[ix[f3 + 2] * 3], p[ix[f3 + 2] * 3 + 1], p[ix[f3 + 2] * 3 + 2]];
			vol += vdot(A, vcross(B, C)) / 6;
		}
		if (open === 0 && vol < 0)
			warns.push('faces parecem viradas para dentro (volume negativo) - use flipNormals()');
		if (mesh.uv) {
			var out = 0;
			for (var uu = 0; uu < mesh.uv.length; uu++) if (mesh.uv[uu] < -4 || mesh.uv[uu] > 5) out++;
			if (out > 0)
				warns.push('UVs muito fora de 0..1 em ' + out + ' valores (textura vai repetir bastante)');
		}
		return {
			errors: errs,
			warnings: warns,
			open: open,
			nonManifold: nonMan,
			degenerate: deg,
			volume: vol,
		};
	}
	function validate(model) {
		if (model.__isMesh) {
			var m2 = new Model();
			m2.add(model);
			model = m2;
		}
		var out = { errors: [], warnings: [], perPart: [] };
		if (!model.parts.length) {
			out.errors.push('modelo sem partes');
			return out;
		}
		var tris = model.triCount();
		if (tris > 250000)
			out.warnings.push(
				'modelo pesado: ' + tris + ' triangulos (jogos: props 300-5000, personagens 5-30k)',
			);
		var d = model.dims();
		if (Math.max(d[0], d[1], d[2]) > 100)
			out.warnings.push(
				'modelo enorme: ' +
					d
						.map(function (x) {
							return x.toFixed(1);
						})
						.join('x') +
					' m - confira a unidade (1 unidade = 1 metro)',
			);
		if (Math.max(d[0], d[1], d[2]) < 0.01 && tris > 0)
			out.warnings.push('modelo minusculo (<1cm) - confira a unidade');
		for (var i = 0; i < model.parts.length; i++) {
			var part = model.parts[i],
				r = validateMesh(part.mesh);
			r.name = part.name;
			r.tris = part.mesh.triCount();
			r.verts = part.mesh.vertCount();
			out.perPart.push(r);
			for (var e = 0; e < r.errors.length; e++)
				out.errors.push('[' + part.name + '] ' + r.errors[e]);
			for (var w = 0; w < r.warnings.length; w++)
				out.warnings.push('[' + part.name + '] ' + r.warnings[w]);
		}
		if (model.skeleton) {
			var sk = model.skeleton;
			for (var bz = 0; bz < sk.bones.length; bz++) {
				var bo = sk.bones[bz];
				if (vlen(vsub(bo.tail, bo.head)) < 1e-5)
					out.warnings.push('osso "' + bo.name + '" com comprimento ~0 (head==tail)');
			}
			var semPesos = 0,
				ruins = 0;
			for (var pz = 0; pz < model.parts.length; pz++) {
				var mz = model.parts[pz].mesh;
				if (!mz.joints) {
					semPesos++;
					continue;
				}
				var vcz = mz.vertCount();
				for (var vz = 0; vz < vcz; vz++) {
					var sw =
						mz.weights[vz * 4] +
						mz.weights[vz * 4 + 1] +
						mz.weights[vz * 4 + 2] +
						mz.weights[vz * 4 + 3];
					if (Math.abs(sw - 1) > 0.01) ruins++;
				}
			}
			if (semPesos)
				out.warnings.push(
					semPesos +
						' parte(s) sem pesos de rig - chame model.bindSkeleton DEPOIS de adicionar todas as partes',
				);
			if (ruins) out.warnings.push('pesos de rig nao normalizados em ' + ruins + ' vertice(s)');
		}
		if (model.clips && model.clips.length) {
			if (!model.skeleton)
				out.errors.push(
					'clips de animacao sem esqueleto - chame model.bindSkeleton(skel) antes de addClip',
				);
			else
				for (var cz = 0; cz < model.clips.length; cz++) {
					var cl = model.clips[cz],
						ks = Object.keys(cl.tracks);
					if (!ks.length) out.warnings.push('clip "' + cl.name + '" sem keyframes');
					for (var kz = 0; kz < ks.length; kz++) {
						var trv = cl.tracks[ks[kz]];
						if (model.skeleton.index[trv.bone] == null)
							out.errors.push('clip "' + cl.name + '": osso desconhecido "' + trv.bone + '"');
					}
				}
		}
		for (var sz = 0; sz < model.parts.length; sz++) {
			var msz = model.parts[sz].mesh;
			if (msz.__softMeta && msz.__softMeta.counts.verts > 8000)
				out.warnings.push(
					'[' +
						model.parts[sz].name +
						'] softbody pesado: ' +
						msz.__softMeta.counts.verts +
						' particulas (ideal ate 8k por parte)',
				);
		}
		return out;
	}
	function report(model) {
		if (model.__isMesh) {
			var m2 = new Model({ name: model.name });
			m2.add(model);
			model = m2;
		}
		var v = validate(model),
			d = model.dims(),
			b = model.bbox();
		var L = [
			'ASSET "' +
				model.name +
				'": ' +
				model.parts.length +
				' parte(s), ' +
				model.triCount() +
				' triangulos',
		];
		L.push(
			'Dimensoes: ' +
				d
					.map(function (x) {
						return +x.toFixed(4);
					})
					.join(' x ') +
				' m | base Y=' +
				+b.min[1].toFixed(4) +
				(Math.abs(b.min[1]) > 0.001 ? ' (dica: model.alignBottom(0) apoia no chao)' : ''),
		);
		for (var i = 0; i < model.parts.length; i++) {
			var p = model.parts[i],
				mat = p.material;
			var texs = [];
			if (mat.baseColorMap) texs.push('albedo ' + mat.baseColorMap.w + 'px');
			if (mat.metallicRoughnessMap) texs.push('metal/rough');
			if (mat.normalMap) texs.push('normal');
			if (mat.emissiveMap) texs.push('emissivo');
			if (mat.occlusionMap) texs.push('AO');
			L.push(
				'- ' +
					p.name +
					': ' +
					p.mesh.triCount() +
					' tris, mat "' +
					mat.name +
					'" (metal ' +
					mat.metallic +
					', rough ' +
					mat.roughness +
					(texs.length ? ', tex: ' + texs.join('+') : '') +
					')',
			);
		}
		if (model.skeleton) {
			var rl = 'Rig: ' + model.skeleton.bones.length + ' osso(s) ("' + model.skeleton.name + '")';
			if (model.clips && model.clips.length)
				rl +=
					' | animacoes: ' +
					model.clips
						.map(function (c) {
							return c.name + ' (' + c.duration().toFixed(2) + 's' + (c.loop ? ', loop' : '') + ')';
						})
						.join(', ');
			L.push(rl);
		}
		var sbV = 0,
			sbL = 0,
			sbP = 0;
		for (var sb = 0; sb < model.parts.length; sb++) {
			var sm = model.parts[sb].mesh.__softMeta;
			if (sm) {
				sbV += sm.counts.verts;
				sbL += sm.counts.links;
				sbP += sm.pins.length;
			}
		}
		if (sbV)
			L.push(
				'Softbody: ' +
					sbV +
					' particula(s), ' +
					sbL +
					' mola(s), ' +
					sbP +
					' pino(s) fixo(s) - dados em mesh.extras.synapseSoftbody + atributo _SOFTNESS',
			);
		if (v.errors.length) L.push('ERROS: ' + v.errors.join(' | '));
		if (v.warnings.length) L.push('Avisos: ' + v.warnings.join(' | '));
		if (!v.errors.length && !v.warnings.length) L.push('Validacao: OK, nenhum problema encontrado');
		return L.join('\n');
	}

	function saveNode(model, path) {
		if (typeof process === 'undefined' || !process.versions || !process.versions.node)
			throw new Error(
				'F.save(model, caminho) so funciona no Node (terminal). No MCP, use return model que o site salva.',
			);
		var bytes = model instanceof Uint8Array ? model : toGLB(model);
		return import('node:fs').then(function (fs) {
			return import('node:path').then(function (pth) {
				var dir = pth.dirname(path);
				if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(path, bytes);
				return { path: path, bytes: bytes.length };
			});
		});
	}

	var DOCS = {};
	DOCS.fluxo = [
		'SYNAPSE FORGE ' + VERSION + ' - modelagem 3D procedural por codigo (F = a biblioteca)',
		'FLUXO RECOMENDADO (MCP): 1) model3d action=docs (este manual); 2) model3d action=forge com code que termina em return model -> o site salva o .glb e ja devolve a FICHA TECNICA com imagem (7 vistas); 3) leia dimensoes/avisos, corrija o codigo e chame forge de novo ate ficar bom; 4) use o .glb no jogo (preview ja enxerga assets/).',
		'REGRAS: unidade = METRO, Y para cima, asset apoiado no chao (model.alignBottom(0)). O codigo roda em sandbox (sem DOM, sem rede) com limite de tempo. Termine com return model (ou return {"assets/a.glb": modelA, "assets/b.glb": modelB}).',
		'NAO empilhe primitivas soltas: esculpa. Combine lathe/extrude/sweep + CSG (union/subtract) + displace/select para formas organicas, e valide com a ficha.',
		'RIG E FISICA: o mesmo forge tambem rigga (esqueleto + pesos, topico rig), anima por keyframes exportados no .glb (topico animacao) e marca fisica softbody com pontos/molas/pinos (topico softbody).',
	].join('\n');
	DOCS.mesh = [
		'PRIMITIVAS (opts em metros): F.box({w,h,d,sx,sy,sz}) F.roundedBox({w,h,d,r,seg}) F.plane({w,d,sx,sz}) F.sphere({r,seg,rings}) F.icosphere({r,sub}) F.cylinder({r|r1,r2,h,seg,hseg,caps}) F.cone({r,h,seg}) F.capsule({r,h,seg}) F.torus({R,r,seg,rseg,arcDeg}) F.disc({r,inner,seg}) F.prism({sides,r,h})',
		'FORMAS 2D: F.shape().moveTo(x,y).lineTo(x,y).arcTo(cx,cy,r,a0,a1).bezierTo(...).quadTo(...) | F.circleShape(r,seg) F.rectShape(w,h,raio) F.polyShape([[x,y],...]) F.starShape(n,r1,r2) F.gearShape(dentes,rFora,rDentro) | furos: shape.addHole(outraForma)',
		'GERADORES: F.lathe(perfil,{seg,angleDeg,caps,smoothDeg}) - revolucao de perfil [[raio,altura],...] (garrafa, taca, pilar). F.extrude(forma,{depth,steps,twistDeg,scaleEnd,bevel:{size,seg}}) - forma 2D vira solido (profundidade em Z). F.sweep(forma,caminho,{scaleFn,twistFn,caps}) - varre perfil por caminho 3D. F.loft([anel1,anel2,...],{caps}) - pele entre aneis 3D.',
		'CAMINHOS: F.path.line(a,b,steps) F.path.circle(r,steps) F.path.arc(r,a0,a1,steps) F.path.helix(r,passo,voltas,steps) F.path.bezier(p0,c1,c2,p1,steps) F.path.spline([p...],steps)',
	].join('\n');
	DOCS.editar = [
		'TRANSFORMAR (encadeavel): m.translate(x,y,z) m.rotateX/Y/Z(graus) m.rotate(eixo,graus) m.scale(s|sx,sy,sz) m.center("xyz") m.alignBottom(0) m.mirror("x",{weld}) m.merge(outra) m.clone()',
		'ARRAYS: m.arrayLinear(n,[dx,dy,dz]) m.arrayRadial(n,{axis:[0,1,0],center,startDeg,stepDeg})',
		'MALHA: m.weld({eps}) une vertices | m.subdivide({iterations,smooth}) suaviza/adensa | m.computeNormals({angleDeg}|"flat"|"smooth") | m.flipNormals()',
		'DEFORMAR: m.twist(graus,"y") m.taper(fatorTopo,"y",fatorBase) m.bend(graus,"y") m.displace(fn(x,y,z,n)=>despl) ou m.displace({scale,amp,octaves,seed}) ruido organico',
		'SELECAO (edicao localizada): m.select({sphere:{c:[x,y,z],r},soft:0.1}) ou {box:{min,max}} {aboveY} {belowY} {all:true} ou fn(x,y,z)=>bool. Depois: sel.move(dx,dy,dz) sel.alongNormal(d) sel.scaleAbout(c,f) sel.rotateAbout(c,eixo,graus) sel.smooth(n). soft = raio de influencia suave.',
		'FACES: m.extrudeFaces((centro,normal,i)=>bool,{dist,inset}) - extruda faces escolhidas (janelas, paineis, greebles)',
	].join('\n');
	DOCS.csg = [
		'BOOLEANAS (CSG): F.union(a,b) F.subtract(a,b) F.intersect(a,b) - recebem e devolvem malhas.',
		'Use para: furos (subtract cilindro), encaixes, cortes, fusao organica de pecas. UVs e normais sao preservados/interpolados.',
		'DICAS: evite faces perfeitamente coplanares (desloque 0.001), mantenha operandos < ~20k tris, solde depois com weld() se necessario. O material da malha final e definido no model.add.',
	].join('\n');
	DOCS.uv = [
		'UVs: m.uvBox({scale}) (caixa, bom padrao) m.uvPlanar("y",{scale}) m.uvCylindrical({scaleU,scaleV}) m.uvSpherical() m.uvTransform(su,sv,offU,offV,rotGraus)',
		'Primitivas e geradores ja saem com UV razoavel. So chame uvBox/uvCylindrical quando a textura aparecer esticada na ficha.',
	].join('\n');
	DOCS.textura = [
		'TEXTURAS PROCEDURAIS: t=F.tex(512,512) (ou 256 para props pequenos).',
		'PINTURA: t.fill(cor) t.gradient(cA,cB,graus) t.radial(cIn,cOut) t.rect(x,y,w,h,cor) t.circle(cx,cy,r,cor) t.line(x0,y0,x1,y1,esp,cor) t.fromFn((u,v)=>cor) t.forEach((px,u,v)=>cor|null)',
		'PADROES: t.checker(nx,ny,cA,cB) t.stripes(n,cA,cB,graus,duty) t.grid(nx,ny,esp,cLinha) t.dots(nx,ny,r,cor) t.bricks({rows,cols,mortar,brick,vary,seed}) t.planks({cols,gap,wood,vary,rings,seed}) t.scratches(qtd,cor,seed) t.spots(qtd,rMin,rMax,cor,seed)',
		'RUIDO: t.noise({type:"fbm|value|worley|worley2|ridged",scale,octaves,seed,colorA,colorB,amount})',
		'AJUSTES: t.mul(cor|tex) t.add(tex,f) t.mix(tex|cor,t|fn) t.adjust({brightness,contrast,saturation}) t.levels(inLo,inHi) t.invert() t.blur(px) t.gray() t.clone()',
		'MAPAS: altura.normalFromHeight(forca) -> normal map | altura.aoFromHeight(forca) -> AO | F.packMR(metal,rough) -> mapa metallicRoughness (aceita numero ou tex em cada canal)',
		'Cores: "#8a5a2b", [r,g,b] 0..1, ou F.hsl(h,s,l). Texturas sao tileaveis quando os padroes usam frequencias inteiras.',
	].join('\n');
	DOCS.material = [
		'PBR: F.material({name, baseColor:"#hex"|[r,g,b], baseColorMap:tex, metallic:0..1, roughness:0..1, metallicMap:tex|n, roughnessMap:tex|n, metallicRoughnessMap:tex, normalMap:tex, normalScale, emissive:cor, emissiveMap:tex, occlusionMap:tex, alpha, alphaMode:"OPAQUE|MASK|BLEND", doubleSided})',
		'Receitas: metal polido {metallic:1,roughness:0.15} | metal gasto {metallic:1,roughnessMap:ruido 0.2..0.7} | madeira {metallic:0,roughness:0.8,baseColorMap:planks} | plastico {0,0.4} | borracha {0,0.95} | vidro {0,0.05,alpha:0.3,alphaMode:"BLEND"} | brasa/neon: emissive/emissiveMap',
		'Normal map: faca uma textura de ALTURA (claro=alto) e converta: h.normalFromHeight(2.5).',
	].join('\n');
	DOCS.rig = [
		'RIG (esqueleto + pesos): sk=F.skeleton({name:"rig"}).addBone({name:"raiz",head:[0,0,0],tail:[0,0.5,0]}).addBone({name:"topo",parent:"raiz",head:[0,0.5,0],tail:[0,1,0]}). head/tail em METROS, no MESMO espaco do modelo (posicione as malhas ANTES). Declare o pai antes do filho.',
		'CADEIAS: sk.chain("tentaculo","raiz",[[0,0.5,0],[0,0.8,0],[0,1.1,0],[0,1.35,0]]) cria tentaculo1..3 encadeados - otimo para caudas, cordas, antenas.',
		'PRESET HUMANOIDE: F.skeletonHumanoid({height:1.8}) - T-pose com quadril, coluna, peito, pescoco, cabeca, ombro/braco/antebraco/mao.L|R, coxa/canela/pe.L|R. Escala tudo pela altura.',
		'PESOS AUTOMATICOS: model.bindSkeleton(sk,{maxInfluences:4,falloff:2}) - peso por distancia ao segmento de cada osso (top-4 normalizado). Chame DEPOIS de model.add de todas as partes e DEPOIS de alignBottom/translate.',
		'PINTURA MANUAL: model.setWeights("cabeca",function(x,y,z){ return y>1.5?1:null; }) - fn devolve 0..1 (influencia do osso) ou null para nao mexer; o resto renormaliza sozinho. Use para consertar juntas/axilas.',
		'EXPORT: o .glb sai com skin (JOINTS_0/WEIGHTS_0 + inverseBindMatrices) - Three.js, Unity, Godot e Blender reconhecem direto. A ficha (report) mostra ossos e avisos de pesos.',
	].join('\n');
	DOCS.animacao = [
		'ANIMACAO (keyframes por osso, tempos em SEGUNDOS): var anda=F.clip("andar",{fps:24,loop:true}); anda.key("coxa.L",0,{rot:[28,0,0]}).key("coxa.L",0.5,{rot:[-28,0,0]}).key("coxa.L",1,{rot:[28,0,0]}); model.addClip(anda);',
		'key(osso, tempo, pose): pose = {rot:[gx,gy,gz] graus (ordem XYZ, gira em torno da CABECA do osso), quat:[x,y,z,w] direto, pos:[dx,dy,dz] deslocamento local, scl:[sx,sy,sz] ou numero}. Interpolacao LINEAR; F.clip(nome,{step:true}) para cortes secos.',
		'Rotacoes sao LOCAIS e hierarquicas: animar braco.L carrega antebraco.L e mao.L juntos. Varios addClip = varias animacoes no mesmo .glb (andar, correr, atacar) - engines importam pelo nome.',
		'Rest pose = a pose em que o modelo foi modelado (T-pose no humanoide). Para verificar: exporte e confira a lista de animacoes na ficha.',
	].join('\n');
	DOCS.softbody = [
		'SOFTBODY (fisica de pontos e molas): model.softbody({soft:1, pin:function(x,y,z){ return x<0.02; }, stiffness:0.55, damping:0.06, mass:1, bend:true, part:"pano"}) - marca os vertices como particulas e gera molas a partir das arestas da malha.',
		'soft: numero 0..1 ou fn(x,y,z)=>0..1 (0=rigido, 1=mole; vira o atributo _SOFTNESS por vertice). pin: fn true = ponto FIXO (ancora). bend:true adiciona molas de flexao (tecido mais estavel). part/parts limita a partes específicas (chame ANTES de adicionar as partes rigidas, ou use part).',
		'No .glb: atributo _SOFTNESS + mesh.extras.synapseSoftbody = {params:{stiffness,damping,mass,iterations}, pins:[indices fixos], links:[a,b,repouso, a,b,repouso, ...]}. No jogo, leia extras e simule Verlet/PBD: para cada mola, corrija as posicoes para o comprimento de repouso, iters vezes por frame, e mantenha os pins parados.',
		'Malha leve = fisica estavel: ate ~8k vertices por parte (a validacao avisa). Receitas: bandeira = F.plane({sx:24,sz:16}) + pin na borda do mastro; gelatina = F.icosphere({sub:3}) + soft:1 + stiffness 0.7; corda = cadeia de F.cylinder finos ou sk.chain + rig.',
	].join('\n');
	DOCS.exportar = [
		'MONTAGEM: model=F.model({name:"bau"}); model.add(malha,material,{name:"corpo"}); model.add(outra,outroMat); model.alignBottom(0);',
		'MCP: termine o code com return model -> o site exporta .glb (glTF 2.0 com PBR e texturas embutidas) e salva no caminho pedido (padrao assets/forge/<nome>.glb). Varios arquivos: return {"assets/a.glb":mA,"assets/b.glb":mB}.',
		'TERMINAL: F.toGLB(model) -> Uint8Array | await F.save(model,"assets/a.glb") grava no disco (Node).',
		'Model: model.dims() model.bbox() model.triCount() model.translate/rotateY/scale/alignBottom/center',
	].join('\n');
	DOCS.validar = [
		'QA: F.validate(model) -> {errors,warnings,perPart} | F.report(model) -> texto da validacao (o forge ja devolve isso).',
		'Checagens: NaN, triangulos degenerados, arestas nao-manifold, bordas abertas, faces viradas (volume negativo), UVs fora, escala suspeita, contagem de tris.',
		'Depois do forge, LEIA A FICHA: confira dimensoes reais, proporcoes nas 7 vistas e avisos. Corrija e rode de novo - iteracao rapida e o objetivo.',
	].join('\n');
	DOCS.terminal = [
		'TERMINAL (opcional): model3d action=forge com install_cli=true instala tools/forge.mjs (a MESMA biblioteca) + tools/forge-exemplo.mjs no projeto.',
		'Depois: run_command "node tools/forge-exemplo.mjs" (requer complemento local + node na allowlist). O script importa F de ./forge.mjs, monta o modelo e await F.save(model,"assets/x.glb"). O arquivo salvo no disco sincroniza de volta ao editor; QA com model3d action=inspect.',
		'Use o terminal quando quiser scripts longos/reutilizaveis; use forge (MCP) para iterar rapido com imagem no retorno. Nao ha Python embutido: o runtime garantido e Node (o relay roda node/npx).',
	].join('\n');
	DOCS.exemplos = [
		'EXEMPLO 1 - caneca com alca (lathe + sweep + subtract):',
		'var perfil=[[0,0],[0.038,0],[0.04,0.002],[0.04,0.095],[0.037,0.095],[0.037,0.01],[0.032,0.008],[0,0.008]];',
		'var corpo=F.lathe(perfil,{seg:48});',
		'var alca=F.sweep(F.circleShape(0.006,12),F.path.arc(0.032,-80,80,24).map(p=>[p[0]+0.028,p[2]*0+0.05+p[2],0.0+p[1]]),{});',
		'/* melhor: monte o caminho da alca com F.path.bezier */',
		'var alca2=F.sweep(F.circleShape(0.006,12),F.path.bezier([0.038,0.075,0],[0.075,0.075,0],[0.075,0.02,0],[0.038,0.02,0],20),{caps:true});',
		'var caneca=F.union(corpo,alca2);',
		'var tex=F.tex(256,256).fill("#e8e4da").stripes(2,[0.9,0.3,0.2,1],[0.91,0.89,0.85,1],90,0.18);',
		'var model=F.model({name:"caneca"}).add(caneca,F.material({name:"ceramica",baseColorMap:tex,roughness:0.35}));',
		'model.alignBottom(0); return model;',
		'',
		'EXEMPLO 2 - barril de madeira (lathe + planks + normal map):',
		'var perfil=[[0,0],[0.28,0],[0.34,0.15],[0.36,0.45],[0.34,0.75],[0.28,0.9],[0,0.9]];',
		'var corpo=F.lathe(perfil,{seg:36}); corpo.uvCylindrical();',
		'var altura=F.tex(512,512).planks({cols:10,gap:0.015,wood:"#8a6a45"}).gray();',
		'var alb=F.tex(512,512).planks({cols:10,gap:0.015,wood:"#7a5a35",vary:0.25}).noise({type:"fbm",scale:9,colorA:[0,0,0],colorB:[1,1,1],amount:0.12});',
		'var mat=F.material({name:"madeira",baseColorMap:alb,roughness:0.85,normalMap:altura.normalFromHeight(2.2)});',
		'var aro=F.torus({R:0.345,r:0.012,seg:36,rseg:10}); var aros=aro.clone(); aros.translate(0,0.18,0); aros.merge(aro.clone().translate(0,0.72,0));',
		'var model=F.model({name:"barril"}).add(corpo,mat).add(aros,F.material({name:"ferro",baseColor:"#5a5a60",metallic:1,roughness:0.45}));',
		'return model;',
		'',
		'EXEMPLO 3 - espada (extrude de forma 2D + bevel + emissivo):',
		'var lamina=F.extrude(F.polyShape([[-0.015,0],[0.015,0],[0.011,0.62],[0,0.7],[-0.011,0.62]]),{depth:0.006,bevel:{size:0.002,seg:2}});',
		'lamina.rotateX(-90); lamina.rotateX(90); /* extrude sai no plano XY com profundidade Z */',
		'var guarda=F.roundedBox({w:0.16,h:0.02,d:0.03,r:0.008}); guarda.translate(0,0.0,0);',
		'var cabo=F.cylinder({r:0.011,h:0.12,seg:16}); cabo.translate(0,-0.07,0);',
		'var pomo=F.sphere({r:0.018,seg:16}); pomo.translate(0,-0.14,0);',
		'var runas=F.tex(256,256).fill([0,0,0,1]).stripes(7,[0.2,0.6,1,1],[0,0,0,1],0,0.12).blur(1);',
		'var mLamina=F.material({name:"aco",baseColor:"#c8ccd4",metallic:1,roughness:0.25,emissiveMap:runas});',
		'var model=F.model({name:"espada"});',
		'model.add(lamina.translate(0,0.02,0),mLamina).add(guarda,F.material({baseColor:"#8a6a2a",metallic:1,roughness:0.4}));',
		'model.add(cabo,F.material({baseColor:"#3a2a1a",roughness:0.9})).add(pomo,F.material({baseColor:"#8a6a2a",metallic:1,roughness:0.4}));',
		'model.alignBottom(0); return model;',
		'',
		'EXEMPLO 4 - boneco riggado com animacao de andar (humanoide + bind + clip):',
		'var sk=F.skeletonHumanoid({height:1.7});',
		'var corpo=F.capsule({r:0.16,h:0.62,seg:16}); corpo.translate(0,1.12,0);',
		'var cabeca=F.sphere({r:0.115,seg:16}); cabeca.translate(0,1.6,0);',
		'var bracoL=F.capsule({r:0.05,h:0.56,seg:10}); bracoL.rotateZ(90); bracoL.translate(0.45,1.34,0);',
		'var bracoR=bracoL.clone(); bracoR.mirror("x");',
		'var pernaL=F.capsule({r:0.07,h:0.82,seg:10}); pernaL.translate(0.085,0.47,0);',
		'var pernaR=pernaL.clone(); pernaR.mirror("x");',
		'var malha=corpo.merge(cabeca).merge(bracoL).merge(bracoR).merge(pernaL).merge(pernaR);',
		'var model=F.model({name:"boneco"}).add(malha,F.material({baseColor:"#7a9acc",roughness:0.7}));',
		'model.bindSkeleton(sk);',
		'var anda=F.clip("andar",{fps:24,loop:true});',
		'anda.key("coxa.L",0,{rot:[28,0,0]}).key("coxa.L",0.5,{rot:[-28,0,0]}).key("coxa.L",1,{rot:[28,0,0]});',
		'anda.key("coxa.R",0,{rot:[-28,0,0]}).key("coxa.R",0.5,{rot:[28,0,0]}).key("coxa.R",1,{rot:[-28,0,0]});',
		'anda.key("braco.L",0,{rot:[-20,0,0]}).key("braco.L",0.5,{rot:[20,0,0]}).key("braco.L",1,{rot:[-20,0,0]});',
		'anda.key("braco.R",0,{rot:[20,0,0]}).key("braco.R",0.5,{rot:[-20,0,0]}).key("braco.R",1,{rot:[20,0,0]});',
		'model.addClip(anda); return model;',
		'',
		'EXEMPLO 5 - bandeira softbody presa no mastro (plane + pin):',
		'var pano=F.plane({w:0.9,d:0.6,sx:24,sz:16}); pano.rotateX(90); pano.translate(0.47,1.42,0);',
		'var tex=F.tex(256,192).fill("#c0392b").stripes(3,[1,1,1,1],[0.75,0.22,0.17,1],0,0.18);',
		'var model=F.model({name:"bandeira"}).add(pano,F.material({name:"tecido",baseColorMap:tex,roughness:0.9,doubleSided:true}));',
		'model.softbody({soft:1,pin:function(x,y,z){ return x<0.04; },stiffness:0.55,damping:0.06,bend:true});',
		'var mastro=F.cylinder({r:0.018,h:2,seg:12}); mastro.translate(0,1,0);',
		'model.add(mastro,F.material({name:"metal",baseColor:"#888a92",metallic:1,roughness:0.4}));',
		'return model;',
	].join('\n');
	function docs(topic) {
		var t = String(topic || '')
			.toLowerCase()
			.trim();
		var order = [
			'fluxo',
			'mesh',
			'editar',
			'csg',
			'uv',
			'textura',
			'material',
			'rig',
			'animacao',
			'softbody',
			'exportar',
			'validar',
			'terminal',
			'exemplos',
		];
		if (t && DOCS[t]) return DOCS[t];
		if (t) {
			var hits = order.filter(function (k) {
				return k.indexOf(t) >= 0 || DOCS[k].toLowerCase().indexOf(t) >= 0;
			});
			if (hits.length)
				return hits
					.map(function (k) {
						return DOCS[k];
					})
					.join('\n\n');
		}
		return order
			.map(function (k) {
				return DOCS[k];
			})
			.join('\n\n');
	}

	var API = {
		VERSION: VERSION,
		mesh: function (name) {
			return new Mesh(name);
		},
		box: box,
		roundedBox: roundedBox,
		plane: plane,
		sphere: sphere,
		icosphere: icosphere,
		cylinder: cylinder,
		cone: cone,
		capsule: capsule,
		torus: torus,
		disc: disc,
		prism: prism,
		shape: function () {
			return new Shape();
		},
		circleShape: circleShape,
		rectShape: rectShape,
		polyShape: polyShape,
		starShape: starShape,
		gearShape: gearShape,
		triangulateShape: triangulateShape,
		lathe: lathe,
		extrude: extrude,
		sweep: sweep,
		loft: loft,
		path: Path,
		union: csgUnion,
		subtract: csgSubtract,
		intersect: csgIntersect,
		tex: function (w, h) {
			return new Tex(w, h);
		},
		packMR: packMR,
		hsl: hsl,
		color: parseColor,
		material: function (opt) {
			return new Material(opt);
		},
		model: function (opt) {
			return new Model(opt);
		},
		skeleton: function (opt) {
			return new Skeleton(opt);
		},
		skeletonHumanoid: skeletonHumanoid,
		clip: function (name, opt) {
			return new AnimClip(name, opt);
		},
		toGLB: toGLB,
		save: saveNode,
		validate: validate,
		report: report,
		docs: docs,
		rand: mulberry32,
		noise2: vnoise2,
		fbm2: fbm2,
		worley2: worley2,
		lerp: lerp,
		clamp: clamp,
		log: function () {},
	};
	return API;
})();
if (typeof module !== 'undefined' && module.exports) {
	module.exports = AuroraForge;
}
if (typeof globalThis !== 'undefined') {
	globalThis.AuroraForge = AuroraForge;
}
`;

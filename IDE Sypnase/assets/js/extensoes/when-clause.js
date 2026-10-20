(function (root) {
	'use strict';

	const TOKEN = /\s*(?:(&&|\|\||==|!=|=~|!|\(|\))|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\/(?:[^/\\]|\\.)+\/[a-z]*)|([A-Za-z_][A-Za-z0-9_.:-]*)|(-?\d+(?:\.\d+)?))/y;
	const cache = new Map();

	function tokenize(source) {
		const tokens = [];
		let index = 0;
		TOKEN.lastIndex = 0;
		while (index < source.length) {
			TOKEN.lastIndex = index;
			const match = TOKEN.exec(source);
			if (!match || match.index !== index) {
				if (/^\s*$/.test(source.slice(index))) break;
				throw new Error(`Cláusula "when" inválida perto de "${source.slice(index, index + 12)}".`);
			}
			index = TOKEN.lastIndex;
			if (match[1]) tokens.push({ type: 'op', value: match[1] });
			else if (match[2]) tokens.push({ type: 'string', value: match[2].slice(1, -1).replace(/\\(.)/g, '$1') });
			else if (match[3]) {
				const end = match[3].lastIndexOf('/');
				tokens.push({ type: 'regex', value: new RegExp(match[3].slice(1, end), match[3].slice(end + 1)) });
			} else if (match[4]) {
				const word = match[4];
				if (word === 'true' || word === 'false') tokens.push({ type: 'bool', value: word === 'true' });
				else tokens.push({ type: 'ident', value: word });
			} else if (match[5]) tokens.push({ type: 'number', value: Number(match[5]) });
		}
		return tokens;
	}

	function parse(tokens) {
		let position = 0;
		const peek = () => tokens[position];
		const take = () => tokens[position++];
		const expectOp = (value) => {
			const token = take();
			if (!token || token.type !== 'op' || token.value !== value) throw new Error(`Esperado "${value}" na cláusula "when".`);
		};

		function primary() {
			const token = take();
			if (!token) throw new Error('Cláusula "when" incompleta.');
			if (token.type === 'op' && token.value === '(') {
				const node = or();
				expectOp(')');
				return node;
			}
			if (token.type === 'op' && token.value === '!') return { kind: 'not', operand: primary() };
			if (token.type === 'ident') return { kind: 'ident', name: token.value };
			if (token.type === 'string' || token.type === 'number' || token.type === 'bool') return { kind: 'literal', value: token.value };
			throw new Error(`Token inesperado "${token.value}" na cláusula "when".`);
		}

		function comparison() {
			const left = primary();
			const token = peek();
			if (token && token.type === 'op' && (token.value === '==' || token.value === '!=' || token.value === '=~')) {
				take();
				if (token.value === '=~') {
					const pattern = take();
					if (!pattern || pattern.type !== 'regex') throw new Error('Operador =~ exige uma expressão regular /.../.');
					return { kind: 'match', left, pattern: pattern.value };
				}
				const right = primary();
				return { kind: token.value === '==' ? 'eq' : 'neq', left, right };
			}
			return left;
		}

		function and() {
			let node = comparison();
			while (peek() && peek().type === 'op' && peek().value === '&&') {
				take();
				node = { kind: 'and', left: node, right: comparison() };
			}
			return node;
		}

		function or() {
			let node = and();
			while (peek() && peek().type === 'op' && peek().value === '||') {
				take();
				node = { kind: 'or', left: node, right: and() };
			}
			return node;
		}

		const tree = or();
		if (position < tokens.length) throw new Error('Cláusula "when" tem tokens sobrando.');
		return tree;
	}

	function compile(source) {
		const text = String(source || '').trim();
		if (!text) return null;
		if (cache.has(text)) return cache.get(text);
		const tree = parse(tokenize(text));
		cache.set(text, tree);
		return tree;
	}

	function valueOf(node, context) {
		if (node.kind === 'literal') return node.value;
		if (node.kind === 'ident') {
			const value = context[node.name];
			return value === undefined ? (typeof context.lookup === 'function' ? context.lookup(node.name) : undefined) : value;
		}
		return evaluateNode(node, context);
	}

	function loose(value) {
		return value === undefined || value === null ? '' : typeof value === 'boolean' ? value : String(value);
	}

	function evaluateNode(node, context) {
		switch (node.kind) {
			case 'and':
				return evaluateNode(node.left, context) && evaluateNode(node.right, context);
			case 'or':
				return evaluateNode(node.left, context) || evaluateNode(node.right, context);
			case 'not':
				return !evaluateNode(node.operand, context);
			case 'eq':
				return loose(valueOf(node.left, context)) === loose(valueOf(node.right, context));
			case 'neq':
				return loose(valueOf(node.left, context)) !== loose(valueOf(node.right, context));
			case 'match':
				return node.pattern.test(String(loose(valueOf(node.left, context))));
			case 'ident':
			case 'literal':
				return !!valueOf(node, context);
			default:
				return false;
		}
	}

	function evaluate(source, context) {
		const tree = compile(source);
		if (!tree) return true;
		return !!evaluateNode(tree, context || {});
	}

	function validate(source) {
		try {
			compile(source);
			return null;
		} catch (error) {
			return error.message;
		}
	}

	root.SynapseWhenClause = Object.freeze({ compile, evaluate, validate });
})(typeof self !== 'undefined' ? self : window);

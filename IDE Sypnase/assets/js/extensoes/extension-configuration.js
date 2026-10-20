(function (root) {
	'use strict';

	const STORAGE_KEY = 'synapse.extensions.configuration';
	const TYPES = Object.freeze(['boolean', 'number', 'integer', 'string', 'array', 'object']);
	const sections = new Map();
	const owners = new Map();
	const listeners = new Set();
	let userValues = readUserValues();

	function reportError(error, context) {
		if (typeof root.ignorarErro === 'function') root.ignorarErro(error, context);
	}

	function readUserValues() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			const parsed = raw ? JSON.parse(raw) : null;
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
		} catch (error) {
			reportError(error, 'extension-configuration.read');
			return {};
		}
	}

	function persist() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(userValues));
		} catch (error) {
			reportError(error, 'extension-configuration.write');
		}
	}

	function notify(change) {
		for (const listener of [...listeners]) {
			try {
				listener(change);
			} catch (error) {
				reportError(error, 'extension-configuration.listener');
			}
		}
	}

	function typeOf(value) {
		if (value === null) return 'null';
		if (Array.isArray(value)) return 'array';
		if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
		return typeof value;
	}

	function matchesType(schema, value) {
		if (value === undefined) return false;
		const actual = typeOf(value);
		if (schema.type === 'number') return actual === 'number' || actual === 'integer';
		if (schema.type === 'integer') return actual === 'integer';
		return actual === schema.type;
	}

	function defaultFor(type) {
		switch (type) {
			case 'boolean':
				return false;
			case 'number':
			case 'integer':
				return 0;
			case 'array':
				return [];
			case 'object':
				return {};
			default:
				return '';
		}
	}

	function humanize(key) {
		const last = key.split('.').pop() || key;
		return last
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			.replace(/[-_]+/g, ' ')
			.replace(/^./, (char) => char.toUpperCase());
	}

	function normalizeProperty(key, raw, errors) {
		if (!raw || typeof raw !== 'object') {
			errors.push(`Propriedade "${key}" deve ser um objeto com "type".`);
			return null;
		}
		const type = TYPES.includes(raw.type) ? raw.type : null;
		if (!type) {
			errors.push(`Propriedade "${key}": tipo "${raw.type}" inválido. Use ${TYPES.join(', ')}.`);
			return null;
		}
		const property = {
			key,
			type,
			title: typeof raw.title === 'string' ? raw.title : humanize(key),
			description: typeof raw.description === 'string' ? raw.description : typeof raw.markdownDescription === 'string' ? raw.markdownDescription : '',
			enum: Array.isArray(raw.enum) ? [...raw.enum] : null,
			enumDescriptions: Array.isArray(raw.enumDescriptions) ? [...raw.enumDescriptions] : null,
			minimum: typeof raw.minimum === 'number' ? raw.minimum : null,
			maximum: typeof raw.maximum === 'number' ? raw.maximum : null,
			multipleOf: typeof raw.multipleOf === 'number' && raw.multipleOf > 0 ? raw.multipleOf : null,
			order: typeof raw.order === 'number' ? raw.order : 0,
			default: raw.default,
		};
		if (!matchesType(property, property.default)) property.default = property.enum && property.enum.length ? property.enum[0] : defaultFor(type);
		return property;
	}

	function normalize(extensionId, fallbackTitle, contribution) {
		const errors = [];
		const blocks = Array.isArray(contribution) ? contribution : contribution ? [contribution] : [];
		const properties = [];
		let title = '';
		blocks.forEach((block) => {
			if (!block || typeof block !== 'object') return;
			if (!title && typeof block.title === 'string') title = block.title;
			const props = block.properties && typeof block.properties === 'object' ? block.properties : {};
			Object.keys(props).forEach((key) => {
				if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(key)) {
					errors.push(`Chave de configuração inválida "${key}".`);
					return;
				}
				const owner = owners.get(key);
				if (owner && owner !== extensionId) {
					errors.push(`Chave "${key}" já é contribuída pela extensão "${owner}".`);
					return;
				}
				const property = normalizeProperty(key, props[key], errors);
				if (property) properties.push(property);
			});
		});
		properties.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
		return { extensionId, title: title || fallbackTitle || extensionId, properties, errors };
	}

	function register(extensionId, fallbackTitle, contribution) {
		unregister(extensionId, true);
		const section = normalize(extensionId, fallbackTitle, contribution);
		if (!section.properties.length) {
			if (section.errors.length) notify({ extensionId, keys: [], registration: true });
			return section;
		}
		sections.set(extensionId, section);
		section.properties.forEach((property) => owners.set(property.key, extensionId));
		notify({ extensionId, keys: section.properties.map((property) => property.key), registration: true });
		return section;
	}

	function unregister(extensionId, silent) {
		const section = sections.get(extensionId);
		if (!section) return false;
		section.properties.forEach((property) => owners.delete(property.key));
		sections.delete(extensionId);
		if (!silent) notify({ extensionId, keys: section.properties.map((property) => property.key), registration: true });
		return true;
	}

	function propertyOf(key) {
		const owner = owners.get(key);
		const section = owner ? sections.get(owner) : null;
		return section ? section.properties.find((property) => property.key === key) || null : null;
	}

	function ownerOf(key) {
		return owners.get(key) || null;
	}

	function get(key) {
		const property = propertyOf(key);
		if (!property) return undefined;
		const value = userValues[key];
		return matchesType(property, value) ? value : property.default;
	}

	function isCustomized(key) {
		return Object.prototype.hasOwnProperty.call(userValues, key);
	}

	function coerce(property, value) {
		if (property.type === 'boolean') return value === true || value === 'true';
		if (property.type === 'number' || property.type === 'integer') {
			let number = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
			if (!Number.isFinite(number)) return null;
			if (property.type === 'integer') number = Math.round(number);
			if (property.minimum !== null && number < property.minimum) number = property.minimum;
			if (property.maximum !== null && number > property.maximum) number = property.maximum;
			return number;
		}
		if (property.type === 'string') return value === null || value === undefined ? '' : String(value);
		if (property.type === 'array' || property.type === 'object') {
			if (typeof value === 'string') {
				try {
					value = JSON.parse(value);
				} catch (error) {
					return null;
				}
			}
			return matchesType(property, value) ? value : null;
		}
		return null;
	}

	function set(key, value, source) {
		const property = propertyOf(key);
		if (!property) return { ok: false, reason: `Configuração "${key}" não está registrada.` };
		let next;
		if (value === undefined) {
			delete userValues[key];
			next = property.default;
		} else {
			next = coerce(property, value);
			if (next === null) return { ok: false, reason: `Valor inválido para "${key}" (esperado ${property.type}).` };
			if (property.enum && !property.enum.includes(next)) {
				return { ok: false, reason: `Valor "${next}" não está entre as opções de "${key}": ${property.enum.join(', ')}.` };
			}
			if (Object.is(userValues[key], next)) return { ok: true, changed: false, value: next };
			userValues[key] = next;
		}
		persist();
		notify({ extensionId: property ? owners.get(key) : null, keys: [key], source: source || 'user' });
		return { ok: true, changed: true, value: next };
	}

	function reset(extensionId) {
		const section = sections.get(extensionId);
		if (!section) return 0;
		const keys = section.properties.filter((property) => isCustomized(property.key)).map((property) => property.key);
		keys.forEach((key) => delete userValues[key]);
		if (keys.length) {
			persist();
			notify({ extensionId, keys, source: 'reset' });
		}
		return keys.length;
	}

	function snapshot() {
		const values = {};
		sections.forEach((section) => {
			section.properties.forEach((property) => {
				values[property.key] = get(property.key);
			});
		});
		return values;
	}

	function inspect(key) {
		const property = propertyOf(key);
		if (!property) return null;
		return {
			key,
			defaultValue: property.default,
			globalValue: isCustomized(key) ? userValues[key] : undefined,
			effectiveValue: get(key),
			owner: owners.get(key),
		};
	}

	function list() {
		return [...sections.values()].map((section) => ({
			extensionId: section.extensionId,
			title: section.title,
			errors: [...section.errors],
			properties: section.properties.map((property) => ({ ...property, value: get(property.key), customized: isCustomized(property.key) })),
		}));
	}

	function subscribe(listener) {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	root.addEventListener('storage', (event) => {
		if (event.key !== STORAGE_KEY) return;
		const before = snapshot();
		userValues = readUserValues();
		const after = snapshot();
		const keys = Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
		if (keys.length) notify({ extensionId: null, keys, source: 'storage' });
	});

	root.SynapseExtensionConfiguration = Object.freeze({
		TYPES,
		register,
		unregister,
		get,
		set,
		reset,
		inspect,
		snapshot,
		list,
		ownerOf,
		propertyOf,
		isCustomized,
		subscribe,
	});
})(window);

(function (root) {
	'use strict';

	const controls = root.SynapseSettingsControls;
	const NUMBER_FALLBACK_RANGE = 1000000;

	let listElement = null;
	let searchTerm = '';
	let subscribed = false;

	function configuration() {
		return root.SynapseExtensionConfiguration;
	}

	function notify(title, subtitle) {
		if (typeof root.toast === 'function') root.toast(title, subtitle, '');
	}

	function matchesSearch(section, property) {
		if (!searchTerm) return true;
		const haystack = [section.title, section.extensionId, property.key, property.title, property.description].join(' ').toLowerCase();
		return haystack.includes(searchTerm);
	}

	function commit(property, value) {
		const result = configuration().set(property.key, value, 'settings');
		if (!result.ok) notify('Valor recusado', result.reason);
		return result;
	}

	function booleanControl(property) {
		return root.SynapseSettingsCheckbox.create(property.value === true, (value) => commit(property, value));
	}

	function enumControl(property) {
		const options = property.enum.map((option, index) => ({
			id: String(option),
			label: property.enumDescriptions && property.enumDescriptions[index] ? `${option} — ${property.enumDescriptions[index]}` : String(option),
		}));
		return root.SynapseSettingsDropdown.create(options, String(property.value), (id) => {
			const original = property.enum.find((option) => String(option) === id);
			commit(property, original);
		});
	}

	function numberControl(property) {
		const integer = property.type === 'integer';
		const step = property.multipleOf || (integer ? 1 : 0.5);
		return root.SynapseSettingsNumberField.create({
			label: property.title,
			value: Number(property.value),
			minimum: property.minimum !== null ? property.minimum : -NUMBER_FALLBACK_RANGE,
			maximum: property.maximum !== null ? property.maximum : NUMBER_FALLBACK_RANGE,
			step,
			unit: '',
			onChange: (value) => commit(property, value),
		});
	}

	function textControl(property) {
		const json = property.type === 'array' || property.type === 'object';
		const input = document.createElement(json ? 'textarea' : 'input');
		input.className = json ? 'settings-text-input settings-text-json' : 'settings-text-input';
		input.spellcheck = false;
		input.setAttribute('aria-label', property.title);
		if (!json) input.type = 'text';
		else input.rows = 3;
		input.value = json ? JSON.stringify(property.value, null, json && Array.isArray(property.value) && property.value.length < 6 ? 0 : 1) : String(property.value);
		input.addEventListener('change', () => {
			const result = commit(property, input.value);
			if (result.ok && json) input.value = JSON.stringify(result.value, null, Array.isArray(result.value) && result.value.length < 6 ? 0 : 1);
			input.classList.toggle('invalid', !result.ok);
		});
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && !json) input.blur();
		});
		return input;
	}

	function controlFor(property) {
		if (property.type === 'boolean') return booleanControl(property);
		if (property.enum && property.enum.length) return enumControl(property);
		if (property.type === 'number' || property.type === 'integer') return numberControl(property);
		return textControl(property);
	}

	function propertyRow(property) {
		const control = controlFor(property);
		const row = controls.createRow(property.title, property.description, control);
		const text = row.querySelector('.settings-row-text');
		const key = controls.createElement('code', 'settings-property-key', property.key);
		text.appendChild(key);
		if (property.customized) {
			row.classList.add('customized');
			const reset = controls.createButton('Padrao', 'ghost', () => configuration().set(property.key, undefined, 'settings'));
			reset.title = 'Voltar ao valor padrao';
			row.querySelector('.settings-row-control').appendChild(reset);
		}
		return row;
	}

	function extensionBlock(section) {
		const properties = section.properties.filter((property) => matchesSearch(section, property));
		if (!properties.length) return null;
		const block = controls.createElement('div', 'settings-extension-block');
		const head = controls.createElement('div', 'settings-extension-head');
		head.appendChild(controls.createElement('span', 'settings-extension-title', section.title));
		head.appendChild(controls.createElement('span', 'settings-extension-id', section.extensionId));
		if (section.properties.some((property) => property.customized)) {
			head.appendChild(
				controls.createButton('Restaurar padroes', 'ghost', () => {
					const count = configuration().reset(section.extensionId);
					notify('Configuracoes restauradas', `${count} valor(es) de ${section.title}`);
				}),
			);
		}
		block.appendChild(head);
		section.errors.forEach((message) => block.appendChild(controls.createElement('p', 'settings-extension-error', message)));
		properties.forEach((property) => block.appendChild(propertyRow(property)));
		return block;
	}

	function render() {
		if (!listElement) return;
		listElement.textContent = '';
		const api = configuration();
		const sections = api ? api.list() : [];
		let visible = 0;
		sections.forEach((section) => {
			const block = extensionBlock(section);
			if (!block) return;
			visible++;
			listElement.appendChild(block);
		});
		if (!visible) {
			const message = sections.length ? 'Nenhuma configuracao corresponde a busca.' : 'Nenhuma extensao ativa contribui configuracoes. Carregue uma extensao pela paleta de comandos.';
			listElement.appendChild(controls.createElement('p', 'settings-empty', message));
		}
	}

	function createTools() {
		const tools = controls.createElement('div', 'settings-shortcut-tools');
		tools.appendChild(
			controls.createSearchField('Buscar configuracao', (value) => {
				searchTerm = value.trim().toLowerCase();
				render();
			}),
		);
		return tools;
	}

	function subscribe() {
		if (subscribed || !configuration()) return;
		subscribed = true;
		configuration().subscribe(() => render());
	}

	function create() {
		const section = controls.createSection('Extensoes');
		section.head.appendChild(createTools());
		searchTerm = '';
		listElement = controls.createElement('div', 'settings-extension-list');
		section.body.appendChild(listElement);
		subscribe();
		render();
		return section.element;
	}

	root.SynapseSettingsExtensionsSection = Object.freeze({
		id: 'extensions',
		label: 'Extensoes',
		create,
	});
})(typeof globalThis !== 'undefined' ? globalThis : window);

(function (root) {
	'use strict';

	const controls = root.SynapseSettingsControls;
	const store = root.SynapseSettingsStore;
	const presets = root.SynapseSettingsDefaults;
	const dropdown = root.SynapseSettingsDropdown;
	const checkbox = root.SynapseSettingsCheckbox;

	function currentMode() {
		return root.SynapseMobileMode ? root.SynapseMobileMode.get() : store.get('mobileLayoutMode');
	}

	function detectionLabel() {
		const classes = document.documentElement.classList;
		if (classes.contains('aurora-narrow')) return 'celular (layout compacto com barra inferior)';
		if (classes.contains('aurora-mobile')) return 'tela pequena ou com toque';
		return 'desktop ou notebook';
	}

	function statusRow() {
		const value = controls.createElement('span', 'settings-mobile-status');
		const refresh = () => {
			const prefix = currentMode() === 'auto' ? 'Detectado agora: ' : 'Forcado por voce: ';
			value.textContent = prefix + detectionLabel();
		};
		refresh();
		root.addEventListener('synapse:mobile-layout', refresh);
		return controls.createRow('Estado atual', 'Como a IDE esta se apresentando neste aparelho.', value);
	}

	function modeRow() {
		const field = dropdown.create(presets.mobileLayoutModes, currentMode(), (identifier) => {
			if (root.SynapseMobileMode) root.SynapseMobileMode.set(identifier);
			else store.set('mobileLayoutMode', identifier);
		});
		return controls.createRow(
			'Modo de interface',
			'Escolha "Sempre modo desktop" se a IDE confundiu um notebook ou tablet com celular. "Automatico" decide pela largura da tela e pelo toque.',
			field,
		);
	}

	function toggleRow(key, label, description) {
		const field = checkbox.create(store.get(key) !== false, (value) => store.set(key, value));
		return controls.createRow(label, description, field);
	}

	function create() {
		const section = controls.createSection('Celular e toque');
		section.body.appendChild(modeRow());
		section.body.appendChild(statusRow());
		section.body.appendChild(
			toggleRow(
				'mobileCodeKeys',
				'Barra de teclas de codigo',
				'Tab, setas, chaves, parenteses e simbolos logo acima do teclado enquanto voce edita.',
			),
		);
		section.body.appendChild(
			toggleRow(
				'mobileLargeTargets',
				'Alvos de toque maiores',
				'Botoes, abas, linhas do explorador e menus com area confortavel para o dedo.',
			),
		);
		section.body.appendChild(
			toggleRow(
				'mobileEdgeSwipe',
				'Gestos de deslizar',
				'Deslize da borda esquerda para abrir os arquivos e deslize a gaveta para a esquerda para fechar.',
			),
		);
		section.body.appendChild(
			toggleRow(
				'mobileLongPress',
				'Toque longo abre o menu',
				'Segurar um arquivo ou pasta no explorador abre o menu de contexto.',
			),
		);
		return section.element;
	}

	root.SynapseSettingsMobileSection = Object.freeze({
		id: 'mobile',
		label: 'Celular',
		create,
	});
})(typeof globalThis !== 'undefined' ? globalThis : window);

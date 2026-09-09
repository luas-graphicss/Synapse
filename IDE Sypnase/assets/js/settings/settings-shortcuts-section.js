(function (root) {
    'use strict';

    const controls = root.SynapseSettingsControls;
    const bindings = root.SynapseShortcutBindings;
    const catalog = root.SynapseShortcutCatalog;
    const format = root.SynapseShortcutFormat;
    const capture = root.SynapseShortcutCapture;

    let listElement = null;
    let searchTerm = '';

    function notify(title, subtitle) {
      if (typeof root.toast === 'function') root.toast(title, subtitle, '');
    }

    function bindingText(shortcut) {
      return shortcut.binding ? format.toLabel(shortcut.binding) : 'Sem atalho';
    }

    function matchesSearch(shortcut) {
      if (!searchTerm) return true;
      const haystack = (shortcut.label + ' ' + bindingText(shortcut)).toLowerCase();
      return haystack.includes(searchTerm);
    }

    function applyCapturedBinding(shortcut, binding) {
      const conflicting = bindings.conflict(shortcut.id, binding);
      bindings.assign(shortcut.id, binding);
      if (conflicting) {
        bindings.assign(conflicting.id, '');
        notify('Atalho reatribuido', conflicting.label + ' ficou sem atalho');
        return;
      }
      notify('Atalho atualizado', shortcut.label + ': ' + format.toLabel(binding));
    }

    function startCapture(shortcut, chip) {
      chip.classList.add('capturing');
      chip.textContent = 'Pressione as teclas';
      capture.start({
          onCapture: (binding) => applyCapturedBinding(shortcut, binding),
          onCancel: () => render(),
      });
    }

    function createShortcutRow(shortcut) {
      const row = controls.createElement('div', 'settings-shortcut');
      row.appendChild(controls.createElement('span', 'settings-shortcut-label', shortcut.label));
      const actions = controls.createElement('div', 'settings-shortcut-actions');
      const chip = controls.createElement(
        'button',
        'settings-shortcut-chip',
        bindingText(shortcut),
      );
      chip.type = 'button';
      chip.title = 'Clique e pressione a nova combinacao';
      if (!shortcut.binding) chip.classList.add('empty');
      chip.addEventListener('click', () => startCapture(shortcut, chip));
      actions.appendChild(chip);
      if (shortcut.binding)
      actions.appendChild(
        controls.createButton('Remover', 'ghost', () => bindings.assign(shortcut.id, '')),
      );
      if (shortcut.customized)
      actions.appendChild(
        controls.createButton('Padrao', 'ghost', () => bindings.clear(shortcut.id)),
      );
      row.appendChild(actions);
      return row;
    }

    function render() {
      if (!listElement) return;
      listElement.textContent = '';
      const shortcuts = bindings.list();
      let visibleCount = 0;
      for (const group of catalog.groups()) {
        const matching = shortcuts.filter(
          (shortcut) => shortcut.group === group.id && matchesSearch(shortcut),
        );
        if (!matching.length) continue;
        visibleCount += matching.length;
        const block = controls.createElement('div', 'settings-shortcut-group');
        block.appendChild(
          controls.createElement('span', 'settings-shortcut-group-title', group.label),
        );
        for (const shortcut of matching) block.appendChild(createShortcutRow(shortcut));
        listElement.appendChild(block);
      }
      if (!visibleCount)
      listElement.appendChild(
        controls.createElement('p', 'settings-empty', 'Nenhum atalho encontrado.'),
      );
    }

    function createTools() {
      const tools = controls.createElement('div', 'settings-shortcut-tools');
      tools.appendChild(
        controls.createSearchField('Buscar atalho', (value) => {
            searchTerm = value.trim().toLowerCase();
            render();
        }),
      );
      tools.appendChild(
        controls.createButton('Restaurar atalhos', 'ghost', () => {
            bindings.resetAll();
            notify('Atalhos restaurados', 'Combinacoes padrao aplicadas');
        }),
      );
      return tools;
    }

    function create() {
      const section = controls.createSection('Atalhos do teclado');
      section.head.appendChild(createTools());
      searchTerm = '';
      listElement = controls.createElement('div', 'settings-shortcut-list');
      section.body.appendChild(listElement);
      render();
      return section.element;
    }

    bindings.subscribe(render);

    root.SynapseSettingsShortcutsSection = Object.freeze({
        id: 'shortcuts',
        label: 'Atalhos',
        create,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);

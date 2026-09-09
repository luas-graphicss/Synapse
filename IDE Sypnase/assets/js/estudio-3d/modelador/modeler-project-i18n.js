'use strict';

const MOD3D_PROJECT_MESSAGES = {
  'Export cancelled': ['Exportação cancelada', 'Exportación cancelada', '导出已取消'],
  'Editable project': ['Projeto editável', 'Proyecto editable', '可编辑项目'],
  'New document': ['Novo documento', 'Documento nuevo', '新建文档'],
  'New scene': ['Nova cena', 'Nueva escena', '新建场景'],
  'Refresh files': ['Atualizar arquivos', 'Actualizar archivos', '刷新文件'],
  'Save local draft': ['Salvar rascunho local', 'Guardar borrador local', '保存本地草稿'],
  'Project file': ['Arquivo do projeto', 'Archivo del proyecto', '项目文件'],
  'Open for editing': ['Abrir para editar', 'Abrir para editar', '打开编辑'],
  'Import geometry only': ['Importar só geometria', 'Importar solo geometría', '仅导入几何体'],
  'Choose a file': ['Escolha um arquivo', 'Elige un archivo', '选择文件'],
  editable: ['editável', 'editable', '可编辑'],
  'Local recovery': ['Recuperação local', 'Recuperación local', '本地恢复'],
  Recover: ['Recuperar', 'Recuperar', '恢复'],
  Discard: ['Descartar', 'Descartar', '丢弃'],
  'Include editable source (complete scene)': [
    'Incluir fonte editável (cena completa)',
    'Incluir fuente editable (escena completa)',
    '包含可编辑源文件（完整场景）',
  ],
  'Compress source when useful': [
    'Comprimir fonte quando útil',
    'Comprimir fuente cuando sea útil',
    '按需压缩源文件',
  ],
  'Edit in modeler': ['Editar no modelador', 'Editar en el modelador', '在建模器中编辑'],
  'Local autosave pending': [
    'Autosave local pendente',
    'Guardado local pendiente',
    '等待本地自动保存',
  ],
  'Saving local draft…': [
    'Salvando rascunho local…',
    'Guardando borrador local…',
    '正在保存本地草稿…',
  ],
  'Local draft saved': ['Rascunho local salvo', 'Borrador local guardado', '本地草稿已保存'],
  'Local autosave failed': [
    'O autosave local falhou',
    'El guardado local falló',
    '本地自动保存失败',
  ],
  'Source saved to project': [
    'Fonte salva no projeto',
    'Fuente guardada en el proyecto',
    '源文件已保存到项目',
  ],
  'Opened editable source': [
    'Fonte editável aberta',
    'Fuente editable abierta',
    '已打开可编辑源文件',
  ],
  'Recovered local draft': [
    'Rascunho local recuperado',
    'Borrador local recuperado',
    '已恢复本地草稿',
  ],
  'Opening document…': ['Abrindo documento…', 'Abriendo documento…', '正在打开文档…'],
  'Wait for the current operation to finish.': [
    'Aguarde a operação atual terminar.',
    'Espera a que termine la operación actual.',
    '请等待当前操作完成。',
  ],
  'Keep the local draft and replace the current scene?': [
    'Manter o rascunho local e substituir a cena atual?',
    '¿Conservar el borrador local y reemplazar la escena actual?',
    '保留本地草稿并替换当前场景？',
  ],
  'Local autosave failed. Continue without a confirmed recovery copy?': [
    'O autosave falhou. Continuar sem cópia de recuperação confirmada?',
    'El guardado local falló. ¿Continuar sin una copia de recuperación confirmada?',
    '本地保存失败。是否在没有已确认恢复副本的情况下继续？',
  ],
  'Import geometry only? Materials, UVs, custom normals and hierarchy will not be preserved. The original file stays unchanged.':
  [
    'Importar apenas geometria? Materiais, UVs, normais personalizadas e hierarquia não serão preservados. O arquivo original não muda.',
    '¿Importar solo geometría? No se conservarán materiales, UV, normales personalizadas ni jerarquía. El original no cambia.',
    '仅导入几何体？材质、UV、自定义法线和层级将不会保留。原文件不会改变。',
  ],
  'Scene changed while opening. Nothing was replaced; open it again when editing is finished.': [
    'A cena mudou durante a abertura. Nada foi substituído; tente novamente após terminar a edição.',
    'La escena cambió durante la apertura. No se reemplazó nada; inténtalo al terminar de editar.',
    '场景在打开时发生变化。未替换任何内容；编辑完成后请重试。',
  ],
  'Discard this local draft? Project files will not change.': [
    'Descartar este rascunho local? Os arquivos do projeto não mudam.',
    '¿Descartar este borrador local? Los archivos del proyecto no cambian.',
    '丢弃此本地草稿？项目文件不会改变。',
  ],
  'Replace these project files? A snapshot and recoverable copies will be created first.': [
    'Substituir estes arquivos? Um snapshot e cópias recuperáveis serão criados antes.',
    '¿Reemplazar estos archivos? Primero se crearán una instantánea y copias recuperables.',
    '替换这些文件？将先创建快照和可恢复副本。',
  ],
  'GLB saved without editable source. Keep the local draft to continue editing.': [
    'GLB salvo sem fonte editável. Mantenha o rascunho local para continuar editando.',
    'GLB guardado sin fuente editable. Conserva el borrador local para continuar editando.',
    'GLB 已保存但不含可编辑源文件。请保留本地草稿以继续编辑。',
  ],
  'Project changed in memory; verify browser persistence before closing.': [
    'O projeto mudou na memória; confira a persistência no navegador antes de fechar.',
    'El proyecto cambió en memoria; comprueba la persistencia antes de cerrar.',
    '项目已在内存中更新；关闭前请检查浏览器持久化。',
  ],
};

Object.assign(MOD3D_PROJECT_MESSAGES, {
    'Document project is closed': [
      'O projeto deste documento está fechado',
      'El proyecto de este documento está cerrado',
      '此文档的项目已关闭',
    ],
    'Untitled scene': ['Cena sem título', 'Escena sin título', '未命名场景'],
    Ready: ['Pronto', 'Listo', '就绪'],
    'Local draft pending…': [
      'Rascunho local pendente…',
      'Borrador local pendiente…',
      '等待保存本地草稿…',
    ],
    'Local recovery unavailable': [
      'Recuperação local indisponível',
      'Recuperación local no disponible',
      '本地恢复不可用',
    ],
    'Unexported changes': ['Alterações não exportadas', 'Cambios sin exportar', '未导出的更改'],
    'Project source unchanged': [
      'Fonte do projeto sem alterações',
      'Fuente del proyecto sin cambios',
      '项目源文件未更改',
    ],
    'Project model or source': [
      'Modelo ou fonte do projeto',
      'Modelo o fuente del proyecto',
      '项目模型或源文件',
    ],
    'Open editable': ['Abrir para editar', 'Abrir para editar', '打开编辑'],
    'Recovery drafts': ['Rascunhos de recuperação', 'Borradores de recuperación', '恢复草稿'],
    'Include editable source (full scene)': [
      'Incluir fonte editável (cena completa)',
      'Incluir fuente editable (escena completa)',
      '包含可编辑源文件（完整场景）',
    ],
    'Compress editable source': [
      'Comprimir fonte editável',
      'Comprimir fuente editable',
      '压缩可编辑源文件',
    ],
    'Local drafts stay in this browser. Export with editable source to include your work in the project ZIP.':
    [
      'Rascunhos ficam neste navegador. Exporte com fonte editável para levar seu trabalho no ZIP do projeto.',
      'Los borradores quedan en este navegador. Exporta con fuente editable para incluir tu trabajo en el ZIP del proyecto.',
      '草稿保留在此浏览器中。导出可编辑源文件以将工作包含在项目 ZIP 中。',
    ],
    'This scene has unexported changes. Keep its local draft and switch scenes?': [
      'Esta cena tem alterações não exportadas. Manter o rascunho local e trocar de cena?',
      'Esta escena tiene cambios sin exportar. ¿Conservar el borrador local y cambiar de escena?',
      '场景有未导出的更改。保留本地草稿并切换场景？',
    ],
    'This scene has changes that are not saved locally. Switch anyway and lose those changes?': [
      'Esta cena tem alterações que não foram salvas localmente. Trocar mesmo assim e perder essas alterações?',
      'Esta escena tiene cambios sin guardar localmente. ¿Cambiar y perder esos cambios?',
      '场景有未保存在本地的更改。是否切换并丢失这些更改？',
    ],
    'Discard this recovery draft? The project files will not change.': [
      'Descartar este rascunho? Os arquivos do projeto não mudam.',
      '¿Descartar este borrador? Los archivos del proyecto no cambian.',
      '丢弃此恢复草稿？项目文件不会改变。',
    ],
    'Replace this model and its linked source? A recoverable backup and snapshot will be created first.':
    [
      'Substituir este modelo e sua fonte? Um backup recuperável e um snapshot serão criados antes.',
      '¿Reemplazar este modelo y su fuente? Primero se crearán una copia recuperable y una instantánea.',
      '替换此模型及其源文件？将先创建可恢复备份和快照。',
    ],
    'Scene changed during the operation. Nothing was replaced; try again.': [
      'A cena mudou durante a operação. Nada foi substituído; tente novamente.',
      'La escena cambió durante la operación. No se reemplazó nada; inténtalo de nuevo.',
      '场景在操作期间发生变化。未替换任何内容；请重试。',
    ],
});

function mod3dTranslateProjectText(key) {
  const translator = window.SYNAPSE_I18N;
  const language =
  translator && typeof translator.idioma === 'function' ? translator.idioma() : 'pt';
  const index = ['pt', 'es', 'zh'].indexOf(language);
  const translations = MOD3D_PROJECT_MESSAGES[key];
  return translations && index >= 0 ? translations[index] : key;
}

if (window.SYNAPSE_I18N) window.SYNAPSE_I18N.modelerProjectText = mod3dTranslateProjectText;

'use strict';

const MOD3D_GLB_MESSAGES = Object.freeze({
    'Export GLB': ['Exportar GLB', 'Export GLB', 'Exportar GLB', '导出 GLB'],
    'Meters, Y up. Validated before writing.': [
      'Metros, eixo Y para cima. Validado antes de gravar.',
      'Meters, Y up. Validated before writing.',
      'Metros, eje Y hacia arriba. Validado antes de guardar.',
      '以米为单位，Y 轴向上。写入前验证。',
    ],
    'File name': ['Nome do arquivo', 'File name', 'Nombre del archivo', '文件名'],
    Textures: ['Texturas', 'Textures', 'Texturas', '纹理'],
    'Use material settings': [
      'Usar configuração do material',
      'Use material settings',
      'Usar ajustes del material',
      '使用材质设置',
    ],
    'Embed textures': ['Embutir texturas', 'Embed textures', 'Incrustar texturas', '嵌入纹理'],
    'Reference project textures': [
      'Referenciar texturas do projeto',
      'Reference project textures',
      'Referenciar texturas del proyecto',
      '引用项目纹理',
    ],
    'Export selection only': [
      'Exportar somente a seleção',
      'Export selection only',
      'Exportar solo la selección',
      '仅导出所选对象',
    ],
    'Overwrite if the file exists': [
      'Sobrescrever se já existir',
      'Overwrite if the file exists',
      'Sobrescribir si ya existe',
      '覆盖现有文件',
    ],
    'Save to project': [
      'Gravar no projeto',
      'Save to project',
      'Guardar en el proyecto',
      '保存到项目',
    ],
    'Nothing saved yet': [
      'Nada gravado ainda',
      'Nothing saved yet',
      'Aún no se ha guardado nada',
      '尚未保存',
    ],
    'Export report': [
      'Relatório de exportação',
      'Export report',
      'Informe de exportación',
      '导出报告',
    ],
    'File size': ['Tamanho', 'File size', 'Tamaño', '文件大小'],
    Triangles: ['Triângulos', 'Triangles', 'Triángulos', '三角形'],
    Vertices: ['Vértices', 'Vertices', 'Vértices', '顶点'],
    Materials: ['Materiais', 'Materials', 'Materiales', '材质'],
    'Removed duplicates': [
      'Duplicatas removidas',
      'Removed duplicates',
      'Duplicados eliminados',
      '已移除重复项',
    ],
    'Structure and Studio round trip passed': [
      'Estrutura e reabertura no Estúdio validadas',
      'Structure and Studio round trip passed',
      'Estructura y reapertura en el Estudio validadas',
      '结构与工作室重新读取验证通过',
    ],
    'Preparing and validating export…': [
      'Preparando e validando exportação…',
      'Preparing and validating export…',
      'Preparando y validando exportación…',
      '正在准备并验证导出…',
    ],
    'No geometry to export': [
      'Nenhuma geometria para exportar',
      'No geometry to export',
      'No hay geometría para exportar',
      '没有可导出的几何体',
    ],
    'Sending blocks': ['Enviando blocos', 'Sending blocks', 'Enviando bloques', '正在发送数据块'],
    'Export rejected. Nothing was written.': [
      'Exportação recusada. Nada foi gravado.',
      'Export rejected. Nothing was written.',
      'Exportación rechazada. No se ha guardado nada.',
      '导出被拒绝。未写入任何文件。',
    ],
    Saved: ['Gravado', 'Saved', 'Guardado', '已保存'],
    'Phase 7': ['Fase 7', 'Phase 7', 'Fase 7', '第 7 阶段'],
    'large-file': [
      'Arquivo acima de 10 MB: considere reduzir a malha ou as texturas.',
      'File exceeds 10 MB: consider reducing geometry or textures.',
      'Archivo superior a 10 MB: reduzca la geometría o las texturas.',
      '文件超过 10 MB：建议精简几何体或纹理。',
    ],
    'many-triangles': [
      'Mais de 200 mil triângulos: confira o desempenho no destino.',
      'More than 200,000 triangles: check performance in the destination.',
      'Más de 200.000 triángulos: compruebe el rendimiento en el destino.',
      '三角形超过 200,000：请检查目标平台性能。',
    ],
    'many-vertices': [
      'Mais de 100 mil vértices: confira o orçamento para web.',
      'More than 100,000 vertices: check your web asset budget.',
      'Más de 100.000 vértices: revise el presupuesto para web.',
      '顶点超过 100,000：请检查网页资源预算。',
    ],
    'many-materials': [
      'Mais de 32 materiais: considere combinar materiais.',
      'More than 32 materials: consider combining materials.',
      'Más de 32 materiales: considere combinar materiales.',
      '材质超过 32 个：建议合并材质。',
    ],
    'large-texture': [
      'Textura acima de 4096 pixels: considere redimensionar.',
      'Texture exceeds 4096 pixels: consider resizing.',
      'Textura superior a 4096 píxeles: considere reducirla.',
      '纹理超过 4096 像素：建议缩小尺寸。',
    ],
    'external-textures': [
      'Mantenha as texturas referenciadas junto do GLB, com os mesmos caminhos.',
      'Keep referenced textures beside the GLB with the same paths.',
      'Mantenga las texturas referenciadas junto al GLB con las mismas rutas.',
      '请将引用纹理与 GLB 保存在一起并保持相同路径。',
    ],
    'No confirmation received. Check the destination before trying again.': [
      'Sem confirmação. Confira o destino antes de tentar novamente.',
      'No confirmation received. Check the destination before trying again.',
      'Sin confirmación. Comprueba el destino antes de volver a intentarlo.',
      '未收到确认。重试前请检查目标项目。',
    ],
});

function mod3dGlbText(key) {
  const translator = window.SYNAPSE_I18N;
  const language =
  translator && typeof translator.idioma === 'function' ? translator.idioma() : 'pt';
  const index = ['pt', 'en', 'es', 'zh'].indexOf(language);
  const translations = MOD3D_GLB_MESSAGES[key];
  return translations ? translations[index < 0 ? 1 : index] : key;
}

'use strict';

const BLENDER_MESH_MODAL_SEGMENT_LIMITS = Object.freeze({ minimum: 1, maximum: 12 });
const BLENDER_MESH_MODAL_BEVEL_START = 0.1;
const BLENDER_MESH_MODAL_LOOP_CUT_START_SEGMENTS = 1;

const BLENDER_MESH_MODAL_OPERATORS = Object.freeze({
    extrude: Object.freeze({
        headerLabel: 'Extrude',
        valueLabel: 'Distância',
        historyLabel: 'Extrudar',
        startValue: MOD3D_DISTANCIA_PADRAO_DA_MALHA,
        unitsPerPixel: 0.01,
        snapStep: 0.05,
        minimumValue: -100,
        maximumValue: 100,
        decimals: 3,
        usesSegments: false,
        startSegments: 1,
        typedSetsSegments: false,
        run: (mesh, selection, value) => mod3dOpExtrudar(mesh, selection, value),
    }),
    inset: Object.freeze({
        headerLabel: 'Inset',
        valueLabel: 'Fator',
        historyLabel: 'Inserir face',
        startValue: MOD3D_FATOR_PADRAO_DA_MALHA,
        unitsPerPixel: 0.003,
        snapStep: 0.05,
        minimumValue: MOD3D_FATOR_MINIMO_DA_MALHA,
        maximumValue: MOD3D_FATOR_MAXIMO_DA_MALHA,
        decimals: 3,
        usesSegments: false,
        startSegments: 1,
        typedSetsSegments: false,
        run: (mesh, selection, value) => mod3dOpInserirFace(mesh, selection, value),
    }),
    bevel: Object.freeze({
        headerLabel: 'Bevel',
        valueLabel: 'Distância',
        historyLabel: 'Chanfrar',
        startValue: BLENDER_MESH_MODAL_BEVEL_START,
        unitsPerPixel: 0.004,
        snapStep: 0.05,
        minimumValue: 0.005,
        maximumValue: 100,
        decimals: 3,
        usesSegments: false,
        startSegments: 1,
        typedSetsSegments: false,
        run: (mesh, selection, value) => mod3dOpChanfrar(mesh, selection, value),
    }),
    shrinkFatten: Object.freeze({
        headerLabel: 'Shrink/Fatten',
        valueLabel: 'Distância',
        historyLabel: 'Encolher/Engordar',
        startValue: MOD3D_DISTANCIA_PADRAO_DA_MALHA,
        unitsPerPixel: 0.01,
        snapStep: 0.05,
        minimumValue: -100,
        maximumValue: 100,
        decimals: 3,
        usesSegments: false,
        startSegments: 1,
        typedSetsSegments: false,
        run: (mesh, selection, value) => shrinkFattenMeshSelection(mesh, selection, value),
    }),
    loopCut: Object.freeze({
        headerLabel: 'Loop Cut',
        valueLabel: 'Deslize',
        historyLabel: 'Corte em anel',
        startValue: 0,
        unitsPerPixel: 0.004,
        snapStep: 0.1,
        minimumValue: -1,
        maximumValue: 1,
        decimals: 2,
        usesSegments: true,
        startSegments: BLENDER_MESH_MODAL_LOOP_CUT_START_SEGMENTS,
        typedSetsSegments: true,
        run: (mesh, selection, value, segments) => loopCutMeshSelection(mesh, selection, segments, value),
    }),
});

function blenderMeshModalDefinition(operatorKey) {
  const definition = BLENDER_MESH_MODAL_OPERATORS[operatorKey];
  return definition ? definition : null;
}

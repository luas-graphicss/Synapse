'use strict';

function blenderRegisterTransformOperators() {
  blenderRegisterOperator('transform.translate', (context) =>
    blenderStartModalTransform(BLENDER_TRANSFORM_TYPES.translate, context.pointer)
  );
  blenderRegisterOperator('transform.rotate', (context) =>
    blenderStartModalTransform(BLENDER_TRANSFORM_TYPES.rotate, context.pointer)
  );
  blenderRegisterOperator('transform.resize', (context) =>
    blenderStartModalTransform(BLENDER_TRANSFORM_TYPES.resize, context.pointer)
  );
  blenderRegisterOperator('transform.pivot_cycle', () => {
      blenderCycleTransformPivot();
      return true;
  });
  blenderRegisterOperator('transform.orientation_cycle', () => {
      blenderCycleTransformOrientation();
      return true;
  });
}

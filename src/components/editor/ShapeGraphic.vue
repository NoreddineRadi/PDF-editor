<template>
  <!-- Dessin d'une forme / d'un symbole dans la boîte unité (viewBox 0..1). Même définition que l'export PDF (shapeDefs). -->
  <svg class="shape-svg" viewBox="0 0 1 1" preserveAspectRatio="none">
    <template v-for="(prim, i) in primitives" :key="i">
      <!-- Zone de clic (invisible) : contour élargi, et intérieur si la forme est remplie -->
      <path
        v-if="interactive"
        :d="prim.d"
        class="shape-hit"
        :fill="prim.fill ? '#000' : 'none'"
        fill-opacity="0"
        stroke="transparent"
        :stroke-width="hitWidth"
        vector-effect="non-scaling-stroke"
        :style="{ pointerEvents: prim.fill ? 'all' : 'stroke' }"
      />
      <path
        :d="prim.d"
        :fill="prim.fill || 'none'"
        :stroke="prim.stroke || 'none'"
        :stroke-width="strokePx"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
        pointer-events="none"
      />
    </template>
  </svg>
</template>

<script>
import { getPrimitives, resolvePaint, segsToSvgPath } from "@/utils/shapeDefs";

export default {
  name: "ShapeGraphic",
  props: {
    annotation: { type: Object, required: true },
    strokePx: { type: Number, default: 2 }, // épaisseur affichée (px)
    interactive: { type: Boolean, default: false },
  },
  computed: {
    primitives() {
      return getPrimitives(this.annotation).map((p) => {
        const paint = resolvePaint(p, this.annotation);
        return { d: segsToSvgPath(p.segs), fill: paint.fill, stroke: paint.stroke };
      });
    },
    hitWidth() {
      return Math.max(this.strokePx, 14);
    },
  },
};
</script>

<style scoped>
.shape-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.shape-hit {
  cursor: pointer;
}
</style>

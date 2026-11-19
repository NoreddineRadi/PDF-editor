<template>
  <div class="tbox-anchor" :style="anchorStyle" :data-annotation-id="annotation.id">
    <!-- Barre flottante : ne pivote pas avec l'élément -->
    <div
      v-if="isSelected && !isInteracting"
      class="tbox-toolbar"
      :style="toolbarStyle"
      @pointerdown.stop
      @click.stop
    >
      <slot name="toolbar" />
      <span v-if="$slots.toolbar" class="tbox-sep"></span>
      <button class="tbox-btn" title="Dupliquer (Ctrl+D)" @click.stop="$emit('duplicate', annotation.id)">⧉</button>
      <button class="tbox-btn" title="Premier plan" @click.stop="$emit('reorder', annotation.id, 'front')">⤒</button>
      <button class="tbox-btn" title="Arrière-plan" @click.stop="$emit('reorder', annotation.id, 'back')">⤓</button>
      <span class="tbox-sep"></span>
      <button class="tbox-btn tbox-danger" title="Supprimer (Suppr)" @click.stop="$emit('delete', annotation.id)">✕</button>
    </div>

    <div
      ref="box"
      class="tbox"
      :class="{ 'is-selected': isSelected, 'is-interacting': isInteracting, 'is-pass-through': passThrough }"
      :style="boxStyle"
      @pointerdown="onBodyPointerDown"
      @click.stop
    >
      <slot />

      <template v-if="isSelected">
        <div
          v-for="h in handles"
          :key="h.id"
          class="tbox-handle"
          :class="'tbox-h-' + h.id"
          :style="{ cursor: h.cursor }"
          @pointerdown.stop.prevent="startResize($event, h)"
        ></div>
        <div class="tbox-rotate-line"></div>
        <div class="tbox-rotate-handle" title="Pivoter (Maj : par pas de 15°)" @pointerdown.stop.prevent="startRotate"></div>
      </template>
    </div>
  </div>
</template>

<script>
import { toRad, normalizeDeg, placeToolbar } from "@/utils/annotationGeometry";

const HANDLES = [
  { id: "nw", dirX: -1, dirY: -1 },
  { id: "n", dirX: 0, dirY: -1 },
  { id: "ne", dirX: 1, dirY: -1 },
  { id: "e", dirX: 1, dirY: 0 },
  { id: "se", dirX: 1, dirY: 1 },
  { id: "s", dirX: 0, dirY: 1 },
  { id: "sw", dirX: -1, dirY: 1 },
  { id: "w", dirX: -1, dirY: 0 },
];
const CURSORS = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];

export default {
  name: "TransformBox",
  props: {
    annotation: { type: Object, required: true },
    pageWidth: { type: Number, required: true },
    pageHeight: { type: Number, required: true },
    isSelected: { type: Boolean, default: false },
    dragFromBody: { type: Boolean, default: true }, // false pour le texte : on déplace via la barre flottante
    lockAspect: { type: Boolean, default: false },
    cornersOnly: { type: Boolean, default: false }, // images : seules les poignées d'angle (les proportions restent justes)
    minWidth: { type: Number, default: 16 },
    minHeight: { type: Number, default: 10 },
    passThrough: { type: Boolean, default: false }, // traits : seule la zone tracée capte la souris tant que non sélectionné
  },
  emits: ["select", "update", "delete", "duplicate", "reorder"],
  data() {
    return {
      live: null, // géométrie en px pendant une interaction (évite de solliciter Pinia à chaque pixel)
      mode: null, // 'drag' | 'resize' | 'rotate'
      start: null,
      moved: false,
    };
  },
  computed: {
    isInteracting() {
      return this.mode !== null && this.moved;
    },

    // Géométrie en px : centre, taille, angle
    geo() {
      if (this.live) return this.live;
      const a = this.annotation;
      const w = (a.width / 100) * this.pageWidth;
      const h = (a.height / 100) * this.pageHeight;
      return {
        cx: (a.x / 100) * this.pageWidth + w / 2,
        cy: (a.y / 100) * this.pageHeight + h / 2,
        w,
        h,
        rot: a.rotation || 0,
      };
    },

    anchorStyle() {
      return {
        left: `${this.geo.cx}px`,
        top: `${this.geo.cy}px`,
        zIndex: this.isSelected ? 40 : 30,
      };
    },

    boxStyle() {
      const g = this.geo;
      return {
        left: `${-g.w / 2}px`,
        top: `${-g.h / 2}px`,
        width: `${g.w}px`,
        height: `${g.h}px`,
        transform: `rotate(${g.rot}deg)`,
      };
    },

    // La barre se place du côté opposé à la poignée de rotation (voir placeToolbar)
    toolbarStyle() {
      const g = this.geo;
      const { top } = placeToolbar({ cy: g.cy, w: g.w, h: g.h, rot: g.rot, pageHeight: this.pageHeight });
      return { top: `${top}px` };
    },

    handles() {
      return HANDLES.filter((h) => !this.cornersOnly || (h.dirX !== 0 && h.dirY !== 0)).map((h) => {
        const ang = (Math.atan2(h.dirY, h.dirX) * 180) / Math.PI + this.geo.rot;
        const idx = ((Math.round(ang / 45) % 8) + 8) % 8;
        return { ...h, cursor: CURSORS[idx % 4] };
      });
    },
  },
  beforeUnmount() {
    this.detach();
  },
  methods: {
    onBodyPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      this.$emit("select", this.annotation.id);
      if (!this.dragFromBody) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT") return;
      e.preventDefault();
      this.startDrag(e);
    },

    /* Méthode publique : aussi appelée depuis la barre flottante du texte */
    startDrag(e) {
      this.begin("drag", e);
    },

    startResize(e, handle) {
      this.begin("resize", e, { handle });
    },

    startRotate(e) {
      const r = this.$refs.box.getBoundingClientRect();
      // Le centre d'un rectangle pivoté est aussi le centre de son enveloppe
      this.begin("rotate", e, { center: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
    },

    begin(mode, e, extra = {}) {
      this.detach();
      this.live = null; // repartir de la géométrie réelle de l'annotation
      const g = { ...this.geo };
      this.mode = mode;
      this.moved = false;
      this.start = { px: e.clientX, py: e.clientY, g, ...extra };
      this.live = { ...g };
      window.addEventListener("pointermove", this.onMove);
      window.addEventListener("pointerup", this.onUp);
      window.addEventListener("pointercancel", this.onUp);
    },

    detach() {
      window.removeEventListener("pointermove", this.onMove);
      window.removeEventListener("pointerup", this.onUp);
      window.removeEventListener("pointercancel", this.onUp);
    },

    onMove(e) {
      if (!this.start) return;
      const s = this.start;
      const dx = e.clientX - s.px;
      const dy = e.clientY - s.py;
      if (!this.moved && Math.hypot(dx, dy) < 2) return;
      this.moved = true;

      if (this.mode === "drag") {
        const cx = Math.max(0, Math.min(this.pageWidth, s.g.cx + dx));
        const cy = Math.max(0, Math.min(this.pageHeight, s.g.cy + dy));
        this.live = { ...s.g, cx, cy };
      } else if (this.mode === "resize") {
        const r = toRad(s.g.rot);
        const c = Math.cos(r);
        const sn = Math.sin(r);
        // Déplacement de la souris exprimé dans les axes (pivotés) de la boîte
        const ldx = dx * c + dy * sn;
        const ldy = -dx * sn + dy * c;
        const { dirX, dirY } = s.handle;

        let w = Math.max(this.minWidth, s.g.w + dirX * ldx);
        let h = Math.max(this.minHeight, s.g.h + dirY * ldy);

        // Proportions conservées sur les coins (toujours pour les images, ou avec Maj)
        if ((this.lockAspect || e.shiftKey) && dirX !== 0 && dirY !== 0) {
          const ratio = s.g.w / s.g.h;
          const k = Math.max(w / s.g.w, h / s.g.h);
          w = Math.max(this.minWidth, s.g.w * k);
          h = w / ratio;
          if (h < this.minHeight) {
            h = this.minHeight;
            w = h * ratio;
          }
        }

        // Le côté / coin opposé reste fixe : le centre se décale de la moitié de la variation
        const lcx = (dirX * (w - s.g.w)) / 2;
        const lcy = (dirY * (h - s.g.h)) / 2;
        this.live = {
          cx: s.g.cx + (lcx * c - lcy * sn),
          cy: s.g.cy + (lcx * sn + lcy * c),
          w,
          h,
          rot: s.g.rot,
        };
      } else if (this.mode === "rotate") {
        let rot = (Math.atan2(e.clientY - s.center.y, e.clientX - s.center.x) * 180) / Math.PI + 90;
        if (e.shiftKey) rot = Math.round(rot / 15) * 15;
        this.live = { ...s.g, rot: normalizeDeg(rot) };
      }
    },

    onUp() {
      this.detach();
      const mode = this.mode;
      const g = this.live;
      const moved = this.moved;
      this.mode = null;
      this.start = null;
      this.moved = false;

      if (moved && g) {
        const x = ((g.cx - g.w / 2) / this.pageWidth) * 100;
        const y = ((g.cy - g.h / 2) / this.pageHeight) * 100;
        if (mode === "drag") {
          this.$emit("update", { x, y });
        } else if (mode === "resize") {
          this.$emit("update", { x, y, width: (g.w / this.pageWidth) * 100, height: (g.h / this.pageHeight) * 100 });
        } else if (mode === "rotate") {
          this.$emit("update", { rotation: normalizeDeg(g.rot) });
        }
      }
      this.live = null;
    },
  },
};
</script>

<!-- Non scopé : la barre et les poignées sont aussi utilisées par le contenu injecté via les slots -->
<style>
.tbox-anchor {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.tbox {
  position: absolute;
  box-sizing: border-box;
  pointer-events: auto;
  transform-origin: 50% 50%;
  user-select: none;
  touch-action: none;
}

.tbox.is-pass-through:not(.is-selected) {
  pointer-events: none;
}

.tbox:hover {
  outline: 1px dashed rgba(37, 99, 235, 0.45);
}

.tbox.is-selected {
  outline: 1.5px dashed #2563eb;
}

.tbox.is-interacting {
  cursor: grabbing;
}

/* Poignées de redimensionnement */
.tbox-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  background: #ffffff;
  border: 1.5px solid #2563eb;
  border-radius: 2px;
  pointer-events: auto;
  z-index: 5;
}
.tbox-h-nw { left: -5px; top: -5px; }
.tbox-h-n { left: calc(50% - 5px); top: -5px; }
.tbox-h-ne { right: -5px; top: -5px; }
.tbox-h-e { right: -5px; top: calc(50% - 5px); }
.tbox-h-se { right: -5px; bottom: -5px; }
.tbox-h-s { left: calc(50% - 5px); bottom: -5px; }
.tbox-h-sw { left: -5px; bottom: -5px; }
.tbox-h-w { left: -5px; top: calc(50% - 5px); }

/* Poignée de rotation */
.tbox-rotate-line {
  position: absolute;
  left: 50%;
  top: -26px;
  width: 0;
  height: 26px;
  border-left: 1.5px solid #2563eb;
  pointer-events: none;
}
.tbox-rotate-handle {
  position: absolute;
  left: calc(50% - 7px);
  top: -35px;
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  background: #2563eb;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: grab;
  pointer-events: auto;
  z-index: 5;
}

/* Barre flottante */
.tbox-toolbar {
  position: absolute;
  left: 0;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 3px 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
  pointer-events: auto;
  z-index: 50;
}

.tbox-btn {
  background: transparent;
  border: none;
  color: #f8fafc;
  min-width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  padding: 0 4px;
  transition: background-color 0.15s;
}
.tbox-btn:hover { background-color: #334155; }
.tbox-btn.tbox-drag { cursor: move; }
.tbox-btn.tbox-danger { color: #f87171; }
.tbox-btn.tbox-danger:hover { background-color: rgba(239, 68, 68, 0.25); }

.tbox-sep {
  width: 1px;
  height: 16px;
  background-color: #475569;
  margin: 0 2px;
}

.tbox-label {
  color: #94a3b8;
  font-size: 12px;
  min-width: 34px;
  text-align: center;
}

.tbox-color {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border: 1px solid #475569;
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
  padding: 0;
  outline: none;
}
.tbox-color::-webkit-color-swatch-wrapper { padding: 0; }
.tbox-color::-webkit-color-swatch { border: none; border-radius: 50%; }
.tbox-color::-moz-color-swatch { border: none; border-radius: 50%; }
</style>

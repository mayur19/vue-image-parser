<script setup lang="ts">
import { ref, computed } from 'vue'
import { UniversalImage } from 'vue-image-parser'

type Fit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
const fits: Fit[] = ['contain', 'cover', 'fill', 'none', 'scale-down']

const samples = {
  wide: 'https://picsum.photos/id/1018/1280/720',
  tall: 'https://picsum.photos/id/1025/720/1280',
  square: 'https://picsum.photos/id/1043/800/800',
}

const selected = ref<keyof typeof samples>('wide')
const src = computed(() => samples[selected.value])
</script>

<template>
  <section class="repro">
    <header>
      <h2>Zoom / Fit Repro</h2>
      <p>
        Verifies that <code>UniversalImage</code> honors <code>object-fit</code>
        when sized by a bounded parent (220×220) with no explicit
        <code>width</code>/<code>height</code> props.
      </p>
      <div class="controls">
        <label v-for="key in (Object.keys(samples) as (keyof typeof samples)[])" :key="key">
          <input
            type="radio"
            :value="key"
            v-model="selected"
          />
          {{ key }}
        </label>
      </div>
    </header>

    <div class="grid">
      <figure v-for="fit in fits" :key="fit">
        <figcaption>fit = <code>{{ fit }}</code></figcaption>
        <div class="box">
          <UniversalImage
            :src="src"
            :fit="fit"
            class="fill"
          />
        </div>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.repro {
  padding: 1.5rem;
  color: var(--text-main, #eee);
}

.repro header {
  margin-bottom: 1rem;
}

.controls {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--panel-bg, rgba(255,255,255,0.04));
  border: 1px solid var(--panel-border, rgba(255,255,255,0.1));
  border-radius: 12px;
  padding: 0.75rem;
}

figcaption {
  font-size: 0.85rem;
  color: var(--text-muted, #999);
}

.box {
  width: 220px;
  height: 220px;
  background: repeating-conic-gradient(#222 0% 25%, #2b2b2b 0% 50%) 50% / 20px 20px;
  border-radius: 8px;
  overflow: hidden;
}

.fill {
  width: 100%;
  height: 100%;
  display: block;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
  color: #60a5fa;
}
</style>

<script setup lang="ts">
/**
 * <UniversalImage /> — Vue 3 component for rendering any image format.
 *
 * Handles loading, decoding, and rendering internally.
 * Supports JPEG, PNG, WebP, GIF, HEIC, AVIF with automatic
 * native vs WASM codec selection.
 */
import { ref, watch, onMounted, onBeforeUnmount, toRef, computed } from 'vue';
import { useImage } from './useImage';
import { renderImage } from '../rendering/renderer';
import { toBlobURL } from '../rendering/bitmap-renderer';
import type { LoadOptions, RenderOptions } from '../types/options';
import { isBrowser } from '../utils/ssr';

const props = withDefaults(
  defineProps<{
    /** Image source: URL, File, Blob, or ArrayBuffer */
    src: string | File | Blob | ArrayBuffer;
    /** Alt text for accessibility */
    alt?: string;
    /** CSS width */
    width?: number | string;
    /** CSS height */
    height?: number | string;
    /** Object-fit behavior */
    fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
    /** Background color for letterboxing */
    background?: string;
    /** Force decode strategy */
    strategy?: 'native' | 'wasm' | 'auto';
    /** Fallback src for error state */
    fallbackSrc?: string;
    /** Show loading placeholder */
    placeholder?: boolean;
    /** Lazy load (IntersectionObserver) */
    lazy?: boolean;
  }>(),
  {
    alt: '',
    fit: 'contain',
    strategy: 'auto',
    placeholder: true,
    lazy: false,
  },
);

const emit = defineEmits<{
  (e: 'load', image: any): void;
  (e: 'error', error: Error): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const imgSrc = ref<string | null>(null);
const isVisible = ref(!props.lazy);

// Reactive source — only load when visible (lazy support)
const effectiveSource = computed(() => {
  if (!isVisible.value) return null;
  return props.src;
});

const loadOptions = computed<LoadOptions>(() => ({
  strategy: props.strategy,
}));

const { loading, decoded, error, format } = useImage(effectiveSource, loadOptions);

let currentBlobUrl: string | null = null;

function revokePreviousBlobUrl(): void {
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
}

// When decoded, render to canvas or create img src
watch(decoded, async (image) => {
  if (!image) {
    revokePreviousBlobUrl();
    imgSrc.value = null;
    return;
  }

  try {
    revokePreviousBlobUrl();
    const blobUrl = await toBlobURL(image);
    // Check if component is still showing the same image (avoid race)
    if (decoded.value === image) {
      currentBlobUrl = blobUrl;
      imgSrc.value = blobUrl;
      emit('load', { format: format.value, width: image.width, height: image.height });
    } else {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (err) {
    // Fallback to canvas rendering if blob URL fails
    if (canvasRef.value) {
      const renderOptions: RenderOptions = {
        fit: props.fit,
        background: props.background,
      };
      renderImage(canvasRef.value, image, renderOptions);
    }
  }
});

// Emit error events
watch(error, (err) => {
  if (err) emit('error', err);
});

// Lazy loading via IntersectionObserver
onMounted(() => {
  if (!props.lazy || !isBrowser()) {
    isVisible.value = true;
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        isVisible.value = true;
        observer.disconnect();
      }
    },
    { threshold: 0.1 },
  );

  if (containerRef.value) {
    observer.observe(containerRef.value);
  }

  onBeforeUnmount(() => observer.disconnect());
});

onBeforeUnmount(() => {
  revokePreviousBlobUrl();
});

// Computed styles
const containerStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  position: 'relative' as const,
  overflow: 'hidden' as const,
  display: 'inline-block' as const,
}));

const imgStyle = computed(() => ({
  width: '100%',
  height: '100%',
  objectFit: props.fit,
  display: 'block',
}));
</script>

<template>
  <div
    ref="containerRef"
    :style="containerStyle"
    class="universal-image"
  >
    <!-- Loading state -->
    <div
      v-if="loading && placeholder"
      class="universal-image__placeholder"
    >
      <slot name="loading">
        <div class="universal-image__spinner" />
      </slot>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error && !fallbackSrc"
      class="universal-image__error"
    >
      <slot name="error" :error="error">
        <span>⚠️ Failed to load image</span>
      </slot>
    </div>

    <!-- Fallback image on error -->
    <img
      v-else-if="error && fallbackSrc"
      :src="fallbackSrc"
      :alt="alt"
      :style="imgStyle"
    />

    <!-- Decoded image rendered as <img> -->
    <img
      v-else-if="imgSrc"
      :src="imgSrc"
      :alt="alt"
      :style="imgStyle"
    />

    <!-- Canvas fallback -->
    <canvas
      v-else
      ref="canvasRef"
      :style="imgStyle"
    />
  </div>
</template>

<style scoped>
.universal-image {
  background: transparent;
}

.universal-image__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 48px;
}

.universal-image__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  animation: universal-image-spin 0.8s linear infinite;
}

.universal-image__error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 48px;
  color: #999;
  font-size: 14px;
}

@keyframes universal-image-spin {
  to { transform: rotate(360deg); }
}
</style>

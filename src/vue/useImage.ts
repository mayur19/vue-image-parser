/**
 * useImage() — Vue 3 composable for reactive image loading and decoding.
 *
 * Provides reactive state for the entire decode pipeline:
 * loading, decoded, error, format — with automatic cleanup on unmount.
 */

import {
  ref,
  shallowRef,
  readonly,
  shallowReadonly,
  onBeforeUnmount,
  watch,
  toValue,
  type Ref,
  type ShallowRef,
  type MaybeRefOrGetter,
} from 'vue';
import type { DecodedImage } from '../types/image';
import type { ImageFormat } from '../types/image';
import type { LoadOptions } from '../types/options';
import { loadImage } from '../engine/loader';
import { isBrowser } from '../utils/ssr';

/**
 * Return type of useImage().
 */
export interface UseImageReturn {
  /** Whether a decode operation is in progress */
  loading: Readonly<Ref<boolean>>;
  /** The decoded image data (null until loaded) */
  decoded: Readonly<ShallowRef<DecodedImage | null>>;
  /** Error from the last load attempt (null on success) */
  error: Readonly<Ref<Error | null>>;
  /** Detected format of the last loaded image */
  format: Readonly<Ref<ImageFormat | null>>;
  /** Manually trigger a load for a specific source */
  load: (source: string | File | Blob | ArrayBuffer, options?: LoadOptions) => Promise<void>;
  /** Dispose decoded image data and abort any in-flight decode */
  dispose: () => void;
}

/**
 * Vue 3 composable for loading and decoding images.
 *
 * @param source - Optional reactive source (URL, File, Blob, ArrayBuffer).
 *                 If provided, auto-loads when the source changes.
 * @param options - Load options (can be reactive)
 *
 * @example
 * ```vue
 * <script setup>
 * import { useImage } from 'vue-image-parser';
 *
 * const { loading, decoded, error } = useImage('/photos/sunset.heic');
 * </script>
 *
 * <template>
 *   <div v-if="loading">Loading...</div>
 *   <div v-else-if="error">{{ error.message }}</div>
 *   <canvas v-else ref="canvasRef" />
 * </template>
 * ```
 */
export function useImage(
  source?: MaybeRefOrGetter<string | File | Blob | ArrayBuffer | null | undefined>,
  options?: MaybeRefOrGetter<LoadOptions>,
): UseImageReturn {
  const loading = ref(false);
  const decoded = shallowRef<DecodedImage | null>(null);
  const error = ref<Error | null>(null);
  const format = ref<ImageFormat | null>(null);

  let abortController: AbortController | null = null;

  /**
   * Load and decode an image.
   */
  async function load(
    src: string | File | Blob | ArrayBuffer,
    loadOptions?: LoadOptions,
  ): Promise<void> {
    if (!isBrowser()) return;

    // Abort any in-flight decode
    abortController?.abort();
    abortController = new AbortController();

    // Clean up previous decoded image
    decoded.value?.dispose();
    decoded.value = null;
    error.value = null;
    loading.value = true;

    const opts = loadOptions ?? (options ? toValue(options) : undefined);

    try {
      const result = await loadImage(src, {
        ...opts,
        signal: abortController.signal,
      });

      decoded.value = result;
      format.value = result.format;
      error.value = null;
    } catch (err) {
      // Don't report abort as an error
      if ((err as Error).name === 'AbortError' || ('code' in (err as object) && (err as { code: string }).code === 'ABORTED')) {
        return;
      }
      error.value = err instanceof Error ? err : new Error(String(err));
      decoded.value = null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Dispose resources and abort in-flight decodes.
   */
  function dispose(): void {
    abortController?.abort();
    abortController = null;
    decoded.value?.dispose();
    decoded.value = null;
    error.value = null;
    format.value = null;
    loading.value = false;
  }

  // Auto-load when reactive source changes
  if (source !== undefined) {
    watch(
      () => toValue(source),
      (newSource) => {
        if (newSource) {
          load(newSource);
        } else {
          dispose();
        }
      },
      { immediate: true },
    );
  }

  // Auto-cleanup on unmount
  onBeforeUnmount(dispose);

  return {
    loading: readonly(loading),
    decoded: shallowReadonly(decoded),
    error: readonly(error),
    format: readonly(format),
    load,
    dispose,
  };
}

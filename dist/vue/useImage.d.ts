import { Ref, ShallowRef, MaybeRefOrGetter } from 'vue';
import { DecodedImage, ImageFormat } from '../types/image';
import { LoadOptions } from '../types/options';

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
export declare function useImage(source?: MaybeRefOrGetter<string | File | Blob | ArrayBuffer | null | undefined>, options?: MaybeRefOrGetter<LoadOptions>): UseImageReturn;
//# sourceMappingURL=useImage.d.ts.map
import { DecodedImage } from '../types/image';
import { RenderOptions, RenderTarget } from '../types/options';

/**
 * Render a decoded image onto a target element.
 *
 * - HTMLCanvasElement: draws directly using Canvas2D
 * - HTMLElement: creates an internal canvas and appends it
 *
 * @throws ImageParserError if rendering fails
 */
export declare function renderImage(target: RenderTarget, image: DecodedImage, options?: RenderOptions): void;
//# sourceMappingURL=renderer.d.ts.map
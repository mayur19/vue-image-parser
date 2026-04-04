/**
 * Vue plugin for global registration of <UniversalImage />.
 */

import type { App, Plugin } from 'vue';
import UniversalImage from './UniversalImage.vue';

/**
 * Vue plugin that globally registers the <UniversalImage /> component.
 *
 * @example
 * ```ts
 * import { createApp } from 'vue';
 * import { ImageParserPlugin } from 'vue-image-parser';
 *
 * const app = createApp(App);
 * app.use(ImageParserPlugin);
 * ```
 */
export const ImageParserPlugin: Plugin = {
  install(app: App) {
    app.component('UniversalImage', UniversalImage);
  },
};

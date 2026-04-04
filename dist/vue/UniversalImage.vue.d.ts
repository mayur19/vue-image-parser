declare function __VLS_template(): {
    loading?(_: {}): any;
    error?(_: {
        error: Error;
    }): any;
};
declare const __VLS_component: import('vue').DefineComponent<import('vue').ExtractPropTypes<__VLS_WithDefaults<__VLS_TypePropsToRuntimeProps<{
    /** Image source: URL, File, Blob, or ArrayBuffer */
    src: string | File | Blob | ArrayBuffer;
    /** Alt text for accessibility */
    alt?: string;
    /** CSS width */
    width?: number | string;
    /** CSS height */
    height?: number | string;
    /** Object-fit behavior */
    fit?: "contain" | "cover" | "fill" | "none" | "scale-down";
    /** Background color for letterboxing */
    background?: string;
    /** Force decode strategy */
    strategy?: "native" | "wasm" | "auto";
    /** Fallback src for error state */
    fallbackSrc?: string;
    /** Show loading placeholder */
    placeholder?: boolean;
    /** Lazy load (IntersectionObserver) */
    lazy?: boolean;
}>, {
    alt: string;
    fit: string;
    strategy: string;
    placeholder: boolean;
    lazy: boolean;
}>>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
    load: (image: any) => void;
    error: (error: Error) => void;
}, string, import('vue').PublicProps, Readonly<import('vue').ExtractPropTypes<__VLS_WithDefaults<__VLS_TypePropsToRuntimeProps<{
    /** Image source: URL, File, Blob, or ArrayBuffer */
    src: string | File | Blob | ArrayBuffer;
    /** Alt text for accessibility */
    alt?: string;
    /** CSS width */
    width?: number | string;
    /** CSS height */
    height?: number | string;
    /** Object-fit behavior */
    fit?: "contain" | "cover" | "fill" | "none" | "scale-down";
    /** Background color for letterboxing */
    background?: string;
    /** Force decode strategy */
    strategy?: "native" | "wasm" | "auto";
    /** Fallback src for error state */
    fallbackSrc?: string;
    /** Show loading placeholder */
    placeholder?: boolean;
    /** Lazy load (IntersectionObserver) */
    lazy?: boolean;
}>, {
    alt: string;
    fit: string;
    strategy: string;
    placeholder: boolean;
    lazy: boolean;
}>>> & Readonly<{
    onError?: ((error: Error) => any) | undefined;
    onLoad?: ((image: any) => any) | undefined;
}>, {
    strategy: "native" | "wasm" | "auto";
    fit: "contain" | "cover" | "fill" | "none" | "scale-down";
    alt: string;
    placeholder: boolean;
    lazy: boolean;
}, {}, {}, {}, string, import('vue').ComponentProvideOptions, true, {}, any>;
declare const _default: __VLS_WithTemplateSlots<typeof __VLS_component, ReturnType<typeof __VLS_template>>;
export default _default;
type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
type __VLS_TypePropsToRuntimeProps<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? {
        type: import('vue').PropType<__VLS_NonUndefinedable<T[K]>>;
    } : {
        type: import('vue').PropType<T[K]>;
        required: true;
    };
};
type __VLS_WithDefaults<P, D> = {
    [K in keyof Pick<P, keyof P>]: K extends keyof D ? __VLS_Prettify<P[K] & {
        default: D[K];
    }> : P[K];
};
type __VLS_Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
type __VLS_WithTemplateSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
//# sourceMappingURL=UniversalImage.vue.d.ts.map
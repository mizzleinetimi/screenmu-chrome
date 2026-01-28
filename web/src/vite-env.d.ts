/// <reference types="vite/client" />

// Declare WASM URL imports for TypeScript
declare module 'engine_core/engine_core_bg.wasm?url' {
    const url: string;
    export default url;
}

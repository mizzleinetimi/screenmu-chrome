// Hook for loading and using the Rust/WASM engine.
// See steering.md: Heavy work happens in workers/WASM.

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
    EngineConfig,
    SignalBatch,
    AnalysisResult,
    Viewport,
} from '../types';

// Import WASM module and binary
import init, { Engine } from 'engine_core';
import wasmUrl from 'engine_core/engine_core_bg.wasm?url';

// WASM module types
interface WasmEngine {
    process_signals(signalsJson: string): string;
    get_viewport_at(timestampUs: bigint): string;
}

interface UseWasmEngineResult {
    isLoading: boolean;
    error: string | null;
    processSignals: (signals: SignalBatch) => AnalysisResult | null;
    getViewportAt: (timestampUs: number) => Viewport | null;
}

export function useWasmEngine(config: EngineConfig): UseWasmEngineResult {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [engine, setEngine] = useState<WasmEngine | null>(null);

    // Memoize config to prevent unnecessary re-initialization
    const configJson = useMemo(() => JSON.stringify(config), [config]);

    useEffect(() => {
        let isMounted = true;

        async function loadEngine() {
            try {
                // Initialize WASM with explicit URL to the wasm file
                await init(wasmUrl);

                // Create engine instance
                const engineInstance = new Engine(configJson) as unknown as WasmEngine;

                if (isMounted) {
                    setEngine(engineInstance);
                    setIsLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    const message = err instanceof Error ? err.message : 'Unknown error loading WASM';
                    console.error('WASM loading error:', err);
                    setError(message);
                    setIsLoading(false);
                }
            }
        }

        loadEngine();

        return () => {
            isMounted = false;
        };
    }, [configJson]);

    const processSignals = useCallback(
        (signals: SignalBatch): AnalysisResult | null => {
            if (!engine) return null;

            try {
                const signalsJson = JSON.stringify(signals);
                const resultJson = engine.process_signals(signalsJson);
                return JSON.parse(resultJson) as AnalysisResult;
            } catch (err) {
                console.error('Error processing signals:', err);
                return null;
            }
        },
        [engine]
    );

    const getViewportAt = useCallback(
        (timestampUs: number): Viewport | null => {
            if (!engine) return null;

            try {
                // Floor to ensure integer for BigInt conversion
                const resultJson = engine.get_viewport_at(BigInt(Math.floor(timestampUs)));
                return JSON.parse(resultJson) as Viewport;
            } catch {
                // Engine may not have keyframes - just return null
                return null;
            }
        },
        [engine]
    );

    return {
        isLoading,
        error,
        processSignals,
        getViewportAt,
    };
}

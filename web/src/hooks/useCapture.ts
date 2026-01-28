// Hook for screen and camera capture using browser APIs.
// See steering.md: Extension code handles capture and permissions.
// This is for the web app standalone mode.

import { useState, useCallback, useRef } from 'react';
import type { CaptureMode, InputEvent, NormalizedCoord } from '../types';

/**
 * Get the preferred MIME type for MediaRecorder based on browser support.
 * Falls back through VP9 -> VP8 -> plain WebM -> MP4 (Safari)
 */
function getPreferredMimeType(): string {
    const codecs = [
        'video/webm;codecs=vp9',  // Best quality, Chrome
        'video/webm;codecs=vp8',  // Good fallback, Firefox
        'video/webm',             // Basic WebM
        'video/mp4',              // Safari only
    ];

    for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
            return codec;
        }
    }

    // No codec specified - let browser choose
    return '';
}

interface CaptureState {
    isCapturing: boolean;
    isPaused: boolean;
    duration: number; // milliseconds
    screenStream: MediaStream | null;
    cameraStream: MediaStream | null;
}

interface UseCaptureResult {
    state: CaptureState;
    startCapture: (mode: CaptureMode, includeCamera: boolean) => Promise<boolean>;
    stopCapture: () => Promise<{ videoBlob: Blob; cameraBlob: Blob | null }>;
    pauseCapture: () => void;
    resumeCapture: () => void;
    addZoomMarker: (position: NormalizedCoord) => void;
    getEvents: () => InputEvent[];
}

export function useCapture(): UseCaptureResult {
    const [state, setState] = useState<CaptureState>({
        isCapturing: false,
        isPaused: false,
        duration: 0,
        screenStream: null,
        cameraStream: null,
    });

    const screenRecorderRef = useRef<MediaRecorder | null>(null);
    const cameraRecorderRef = useRef<MediaRecorder | null>(null);
    const screenChunksRef = useRef<Blob[]>([]);
    const cameraChunksRef = useRef<Blob[]>([]);
    const eventsRef = useRef<InputEvent[]>([]);
    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<number | null>(null);
    const mimeTypeRef = useRef<string>('');

    const getCurrentTimestampUs = useCallback(() => {
        return (performance.now() - startTimeRef.current) * 1000;
    }, []);

    const startCapture = useCallback(
        async (mode: CaptureMode, includeCamera: boolean): Promise<boolean> => {
            try {
                // Detect Safari - it has different getDisplayMedia capabilities
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

                // Request screen capture
                // Safari doesn't support audio capture in getDisplayMedia
                // and has limited constraint support
                const displayMediaOptions: DisplayMediaStreamOptions = {
                    video: isSafari
                        ? true  // Safari: use simple constraints
                        : {
                            displaySurface: mode === 'Window' ? 'window' : 'monitor',
                        },
                    audio: !isSafari,  // Safari doesn't support audio capture
                };

                const screenStream = await navigator.mediaDevices.getDisplayMedia(
                    displayMediaOptions
                );

                let cameraStream: MediaStream | null = null;
                if (includeCamera) {
                    try {
                        cameraStream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: 'user', width: 320, height: 240 },
                            audio: false,
                        });
                    } catch {
                        console.warn('Camera access denied, continuing without camera');
                    }
                }

                // Set up MediaRecorders with cross-browser codec support
                screenChunksRef.current = [];
                cameraChunksRef.current = [];
                eventsRef.current = [];

                const mimeType = getPreferredMimeType();
                mimeTypeRef.current = mimeType;

                const recorderOptions: MediaRecorderOptions = mimeType
                    ? { mimeType }
                    : {};

                const screenRecorder = new MediaRecorder(screenStream, recorderOptions);
                screenRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        screenChunksRef.current.push(e.data);
                    }
                };
                screenRecorderRef.current = screenRecorder;

                if (cameraStream) {
                    const cameraRecorder = new MediaRecorder(cameraStream, recorderOptions);
                    cameraRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            cameraChunksRef.current.push(e.data);
                        }
                    };
                    cameraRecorderRef.current = cameraRecorder;
                }

                // Start recording
                startTimeRef.current = performance.now();
                screenRecorder.start(100); // Collect data every 100ms
                if (cameraRecorderRef.current) {
                    cameraRecorderRef.current.start(100);
                }

                // Start duration timer
                timerRef.current = window.setInterval(() => {
                    setState((prev) => ({
                        ...prev,
                        duration: performance.now() - startTimeRef.current,
                    }));
                }, 100);

                setState({
                    isCapturing: true,
                    isPaused: false,
                    duration: 0,
                    screenStream,
                    cameraStream,
                });

                return true;
            } catch (err) {
                console.error('Capture failed:', err);
                return false;
            }
        },
        []
    );

    const stopCapture = useCallback(async (): Promise<{
        videoBlob: Blob;
        cameraBlob: Blob | null;
    }> => {
        return new Promise((resolve) => {
            // Stop timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            // Stop screen recorder
            const screenRecorder = screenRecorderRef.current;
            let cameraResolved = cameraRecorderRef.current === null;
            let screenResolved = false;
            let videoBlob: Blob | null = null;
            let cameraBlob: Blob | null = null;

            const checkComplete = () => {
                if (screenResolved && cameraResolved && videoBlob) {
                    // Stop streams
                    state.screenStream?.getTracks().forEach((t) => t.stop());
                    state.cameraStream?.getTracks().forEach((t) => t.stop());

                    setState({
                        isCapturing: false,
                        isPaused: false,
                        duration: 0,
                        screenStream: null,
                        cameraStream: null,
                    });

                    resolve({ videoBlob, cameraBlob });
                }
            };

            if (screenRecorder) {
                screenRecorder.onstop = () => {
                    // Use detected MIME type or fallback to webm
                    const type = mimeTypeRef.current || 'video/webm';
                    videoBlob = new Blob(screenChunksRef.current, { type });
                    screenResolved = true;
                    checkComplete();
                };
                screenRecorder.stop();
            }

            if (cameraRecorderRef.current) {
                cameraRecorderRef.current.onstop = () => {
                    const type = mimeTypeRef.current || 'video/webm';
                    cameraBlob = new Blob(cameraChunksRef.current, { type });
                    cameraResolved = true;
                    checkComplete();
                };
                cameraRecorderRef.current.stop();
            }
        });
    }, [state.screenStream, state.cameraStream]);

    const pauseCapture = useCallback(() => {
        screenRecorderRef.current?.pause();
        cameraRecorderRef.current?.pause();
        setState((prev) => ({ ...prev, isPaused: true }));
    }, []);

    const resumeCapture = useCallback(() => {
        screenRecorderRef.current?.resume();
        cameraRecorderRef.current?.resume();
        setState((prev) => ({ ...prev, isPaused: false }));
    }, []);

    const addZoomMarker = useCallback(
        (position: NormalizedCoord) => {
            const event: InputEvent = {
                timestamp: getCurrentTimestampUs(),
                event_type: { type: 'MouseClick', position, button: 0 },
            };
            eventsRef.current.push(event);
        },
        [getCurrentTimestampUs]
    );

    const getEvents = useCallback(() => {
        return [...eventsRef.current];
    }, []);

    return {
        state,
        startCapture,
        stopCapture,
        pauseCapture,
        resumeCapture,
        addZoomMarker,
        getEvents,
    };
}

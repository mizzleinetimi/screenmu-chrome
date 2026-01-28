// Recording View - main recording interface
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCapture } from '../hooks/useCapture';
import type { CaptureMode, NormalizedCoord, Project, SignalBatch } from '../types';
import '../styles/RecordView.css';

interface RecordViewProps {
    onRecordingComplete: (project: Project) => void;
}

export function RecordView({ onRecordingComplete }: RecordViewProps) {
    const { state, startCapture, stopCapture, pauseCapture, resumeCapture, addZoomMarker, getEvents } = useCapture();
    const [captureMode, setCaptureMode] = useState<CaptureMode>('Screen');
    const [includeCamera, setIncludeCamera] = useState(true);
    const [countdown, setCountdown] = useState<number | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const cameraRef = useRef<HTMLVideoElement>(null);

    // Attach screen stream to video element
    useEffect(() => {
        if (videoRef.current && state.screenStream) {
            videoRef.current.srcObject = state.screenStream;
        }
    }, [state.screenStream]);

    // Attach camera stream to video element
    useEffect(() => {
        if (cameraRef.current && state.cameraStream) {
            cameraRef.current.srcObject = state.cameraStream;
        }
    }, [state.cameraStream]);

    // Keyboard shortcut for zoom marker
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'z' && state.isCapturing && !state.isPaused) {
                // Default to center if no mouse position
                addZoomMarker({ x: 0.5, y: 0.5 });
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.isCapturing, state.isPaused, addZoomMarker]);

    const handleStart = useCallback(async () => {
        // Safari requires getDisplayMedia to be called directly from user gesture
        // The countdown breaks this, so skip it on Safari
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

        if (!isSafari) {
            // Countdown before recording (non-Safari only)
            setCountdown(3);
            for (let i = 3; i > 0; i--) {
                setCountdown(i);
                await new Promise((r) => setTimeout(r, 1000));
            }
            setCountdown(null);
        }

        await startCapture(captureMode, includeCamera);
    }, [captureMode, includeCamera, startCapture]);

    const handleStop = useCallback(async () => {
        const { videoBlob, cameraBlob } = await stopCapture();
        const events = getEvents();

        const project: Project = {
            id: crypto.randomUUID(),
            name: `Recording ${new Date().toLocaleString()}`,
            createdAt: Date.now(),
            captureMode,
            duration: state.duration * 1000, // to microseconds
            videoBlob,
            cameraBlob: cameraBlob ?? undefined,
            signals: { events } as SignalBatch,
            editSettings: {
                zoomStrength: 1.5,
                padding: 0.1,
                theme: 'dark',
                clickRings: true,
                cursorHighlight: true,
            },
        };

        onRecordingComplete(project);
    }, [stopCapture, getEvents, captureMode, state.duration, onRecordingComplete]);

    const handlePreviewClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!state.isCapturing || state.isPaused) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const position: NormalizedCoord = {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height,
            };
            addZoomMarker(position);
        },
        [state.isCapturing, state.isPaused, addZoomMarker]
    );

    const formatDuration = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="record-view">
            {countdown !== null && (
                <div className="countdown-overlay">
                    <span className="countdown-number">{countdown}</span>
                </div>
            )}

            <div className="preview-container" onClick={handlePreviewClick}>
                {state.screenStream ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="screen-preview"
                        />
                        {state.cameraStream && (
                            <video
                                ref={cameraRef}
                                autoPlay
                                muted
                                playsInline
                                className="camera-pip"
                            />
                        )}
                        <div className="recording-indicator">
                            <span className="recording-dot" />
                            <span className="recording-time">{formatDuration(state.duration)}</span>
                        </div>
                        <div className="zoom-hint">Click or press Z to mark zoom point</div>
                    </>
                ) : (
                    <div className="preview-placeholder">
                        <p>Select capture settings and click Start</p>
                    </div>
                )}
            </div>

            <div className="controls-panel">
                {!state.isCapturing ? (
                    <>
                        <div className="capture-options">
                            <label>
                                <span>Capture Mode:</span>
                                <select
                                    value={captureMode}
                                    onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
                                >
                                    <option value="Screen">Entire Screen</option>
                                    <option value="Window">Window</option>
                                    <option value="Tab">Browser Tab</option>
                                </select>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includeCamera}
                                    onChange={(e) => setIncludeCamera(e.target.checked)}
                                />
                                <span>Include Camera</span>
                            </label>
                        </div>
                        <button className="btn btn-primary btn-large" onClick={handleStart}>
                            Start Recording
                        </button>
                    </>
                ) : (
                    <div className="recording-controls">
                        {state.isPaused ? (
                            <button className="btn btn-secondary" onClick={resumeCapture}>
                                Resume
                            </button>
                        ) : (
                            <button className="btn btn-secondary" onClick={pauseCapture}>
                                Pause
                            </button>
                        )}
                        <button className="btn btn-danger" onClick={handleStop}>
                            Stop Recording
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

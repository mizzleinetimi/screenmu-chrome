// EditView - Timeline editor for adjusting zoom keyframes
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useWasmEngine } from '../hooks/useWasmEngine';
import { Timeline } from '../components/Timeline';
import { UndoManager, type EditAction } from '../editing/UndoManager';
import type { Project, ZoomMarker, AnalysisResult, EngineConfig, Viewport, NormalizedCoord, TimeRange, SpeedRamp, ZoomSegment } from '../types';
import '../styles/EditView.css';

// Import rendering utilities for compositor-based export
import {
    CanvasCompositor,
    createConfigFromEditSettings,
    findActiveEffects,
    generateFrameTimestampsWithRemap,
    waitForVideoSeek,
    calculateCameraBubbleBounds,
    DEFAULT_CAMERA_BUBBLE_CONFIG,
    MIN_CAMERA_BUBBLE_SIZE,
    MAX_CAMERA_BUBBLE_SIZE,
    MAX_BACKGROUND_BLUR,
    clampCameraBubbleSize,
    clampBackgroundBlur,
    interpolateViewportCombined,
    // Audio handling during speed ramps (Requirement 4.6)
    shouldMuteAudioAtSpeed,
    getAudioPlaybackRate,
} from '../rendering';
import { GRADIENT_PRESETS } from '../rendering/background';

interface EditViewProps {
    project: Project;
    onExport?: (project: Project) => void;
    onBack: () => void;
    onProjectUpdate?: (project: Project) => void;
}

export function EditView({ project, onBack, onProjectUpdate }: EditViewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const cameraRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [zoomMarkers, setZoomMarkers] = useState<ZoomMarker[]>([]);
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
        project.analysisResult ?? null
    );

    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    // Camera bubble drag state - Requirements 4.1, 4.8
    const [isDraggingCameraBubble, setIsDraggingCameraBubble] = useState(false);
    const [cameraBubbleDragOffset, setCameraBubbleDragOffset] = useState<NormalizedCoord>({ x: 0, y: 0 });
    const [localCameraBubblePosition, setLocalCameraBubblePosition] = useState<NormalizedCoord>(
        project.editSettings.cameraBubblePosition ?? DEFAULT_CAMERA_BUBBLE_CONFIG.position
    );

    // Trim state - Requirements 2.2, 2.3
    // Initialize from project settings or default to full duration
    const [inPoint, setInPoint] = useState<number>(
        project.editSettings.inPoint ?? 0
    );
    const [outPoint, setOutPoint] = useState<number>(
        project.editSettings.outPoint ?? project.duration
    );

    // Cut segments state - Requirement 3.1
    // Initialize from project settings or default to empty array
    const [cuts, setCuts] = useState<TimeRange[]>(
        project.editSettings.cuts ?? []
    );
    const [selectedCutIndex, setSelectedCutIndex] = useState<number | null>(null);
    
    // Cut creation workflow state - Requirement 3.1
    // Tracks the in-progress cut being created (cut-in point set, waiting for cut-out)
    const [cutInProgress, setCutInProgress] = useState<number | null>(null);

    // Speed ramp state - Requirements 4.1, 4.2, 4.3
    // Initialize from project settings or default to empty array
    const [speedRamps, setSpeedRamps] = useState<SpeedRamp[]>(
        project.editSettings.speedRamps ?? []
    );
    const [selectedRampIndex, setSelectedRampIndex] = useState<number | null>(null);
    
    // Speed ramp creation workflow state - Requirement 4.1
    // Tracks the in-progress speed ramp being created (start point set, waiting for end)
    const [rampInProgress, setRampInProgress] = useState<{ start: number; speed: number } | null>(null);
    
    // Default speed for new speed ramps (can be adjusted before completing the ramp)
    const [pendingRampSpeed, setPendingRampSpeed] = useState<number>(2.0);

    // Zoom segments state - draggable zoom regions
    const [zoomSegments, setZoomSegments] = useState<ZoomSegment[]>([]);
    const [selectedZoomSegmentIndex, setSelectedZoomSegmentIndex] = useState<number | null>(null);
    
    // Zoom segment creation workflow state
    const [zoomSegmentInProgress, setZoomSegmentInProgress] = useState<number | null>(null);
    const [pendingZoomLevel] = useState<number>(1.5);

    // Real-time mouse position over canvas for zoom tracking
    // This tracks where the user's cursor is so zoom segments can follow it
    const mousePositionRef = useRef<NormalizedCoord>({ x: 0.5, y: 0.5 });
    // State version of mouse position to trigger re-renders when in zoom segments
    const [mousePosition, setMousePosition] = useState<NormalizedCoord>({ x: 0.5, y: 0.5 });

    // Undo manager for tracking editing operations
    // Validates: Requirement 5.4 - THE undo history SHALL include: keyframe changes, trim changes, cut changes, speed ramp changes
    const [undoManager] = useState<UndoManager>(() => new UndoManager());
    // Force re-render when undo/redo state changes
    const [, setUndoRedoTrigger] = useState(0);

    const engineConfig: EngineConfig = useMemo(
        () => ({
            capture_mode: project.captureMode,
            camera_settings: {
                zoom_strength: project.editSettings.zoomStrength,
            },
            effect_settings: {
                click_rings: project.editSettings.clickRings,
                cursor_highlight: project.editSettings.cursorHighlight,
            },
        }),
        [project]
    );

    const { isLoading, error, processSignals } = useWasmEngine(engineConfig);

    /**
     * Records an edit action in the undo manager and triggers a re-render.
     * This helper ensures all editing operations are tracked for undo/redo.
     * Validates: Requirement 5.4 - THE undo history SHALL include: keyframe changes, trim changes, cut changes, speed ramp changes
     */
    const recordAction = useCallback((action: EditAction) => {
        undoManager.push(action);
        // Trigger re-render to update undo/redo button states
        setUndoRedoTrigger(prev => prev + 1);
    }, [undoManager]);

    /**
     * Handles undo operation by reversing the last action.
     * Validates: Requirement 5.2 - THE user SHALL be able to undo the last action using Ctrl/Cmd+Z
     */
    const handleUndo = useCallback(() => {
        const action = undoManager.undo();
        if (!action) return;

        // Reverse the action based on its type
        switch (action.type) {
            case 'add_keyframe':
                // Reverse add_keyframe: remove the keyframe
                setZoomMarkers(prev => prev.filter(m => m.id !== action.keyframe.id));
                if (selectedMarkerId === action.keyframe.id) {
                    setSelectedMarkerId(null);
                }
                break;

            case 'delete_keyframe':
                // Reverse delete_keyframe: add the keyframe back
                setZoomMarkers(prev => 
                    [...prev, action.keyframe].sort((a, b) => a.timestamp - b.timestamp)
                );
                break;

            case 'update_keyframe':
                // Reverse update_keyframe: restore the 'before' state
                setZoomMarkers(prev =>
                    prev.map(m => m.id === action.id ? action.before : m)
                        .sort((a, b) => a.timestamp - b.timestamp)
                );
                break;

            case 'set_trim':
                // Reverse set_trim: restore the 'before' trim points
                setInPoint(action.before.start);
                setOutPoint(action.before.end);
                if (onProjectUpdate) {
                    const updatedProject: Project = {
                        ...project,
                        editSettings: {
                            ...project.editSettings,
                            inPoint: action.before.start,
                            outPoint: action.before.end,
                        },
                    };
                    onProjectUpdate(updatedProject);
                }
                break;

            case 'add_cut':
                // Reverse add_cut: remove the cut
                {
                    const newCuts = cuts.filter(c => 
                        c.start !== action.cut.start || c.end !== action.cut.end
                    );
                    setCuts(newCuts);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                cuts: newCuts,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;

            case 'remove_cut':
                // Reverse remove_cut: add the cut back
                {
                    const newCuts = [...cuts, action.cut].sort((a, b) => a.start - b.start);
                    setCuts(newCuts);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                cuts: newCuts,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;

            case 'add_speed_ramp':
                // Reverse add_speed_ramp: remove the speed ramp
                {
                    const newRamps = speedRamps.filter(r => 
                        r.range.start !== action.ramp.range.start || 
                        r.range.end !== action.ramp.range.end
                    );
                    setSpeedRamps(newRamps);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                speedRamps: newRamps,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;

            case 'update_speed_ramp':
                // Reverse update_speed_ramp: restore the 'before' state
                {
                    const newRamps = speedRamps.map(r => 
                        r.range.start === action.after.range.start && 
                        r.range.end === action.after.range.end
                            ? action.before
                            : r
                    );
                    setSpeedRamps(newRamps);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                speedRamps: newRamps,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;

            case 'remove_speed_ramp':
                // Reverse remove_speed_ramp: add the speed ramp back
                {
                    const newRamps = [...speedRamps, action.ramp].sort((a, b) => a.range.start - b.range.start);
                    setSpeedRamps(newRamps);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                speedRamps: newRamps,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;
        }

        // Trigger re-render to update undo/redo button states
        setUndoRedoTrigger(prev => prev + 1);
    }, [undoManager, selectedMarkerId, cuts, speedRamps, project, onProjectUpdate]);

    /**
     * Handles redo operation by reapplying the next undone action.
     * Validates: Requirement 5.3 - THE user SHALL be able to redo an undone action using Ctrl/Cmd+Shift+Z
     */
    const handleRedo = useCallback(() => {
        const action = undoManager.redo();
        if (!action) return;

        // Reapply the action based on its type
        switch (action.type) {
            case 'add_keyframe':
                // Reapply add_keyframe: add the keyframe
                setZoomMarkers(prev => 
                    [...prev, action.keyframe].sort((a, b) => a.timestamp - b.timestamp)
                );
                break;

            case 'delete_keyframe':
                // Reapply delete_keyframe: remove the keyframe
                setZoomMarkers(prev => prev.filter(m => m.id !== action.keyframe.id));
                if (selectedMarkerId === action.keyframe.id) {
                    setSelectedMarkerId(null);
                }
                break;

            case 'update_keyframe':
                // Reapply update_keyframe: apply the 'after' state
                setZoomMarkers(prev =>
                    prev.map(m => m.id === action.id ? action.after : m)
                        .sort((a, b) => a.timestamp - b.timestamp)
                );
                break;

            case 'set_trim':
                // Reapply set_trim: apply the 'after' trim points
                setInPoint(action.after.start);
                setOutPoint(action.after.end);
                if (onProjectUpdate) {
                    const updatedProject: Project = {
                        ...project,
                        editSettings: {
                            ...project.editSettings,
                            inPoint: action.after.start,
                            outPoint: action.after.end,
                        },
                    };
                    onProjectUpdate(updatedProject);
                }
                break;

            case 'add_cut':
                // Reapply add_cut: add the cut
                {
                    const newCuts = [...cuts, action.cut].sort((a, b) => a.start - b.start);
                    setCuts(newCuts);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                cuts: newCuts,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;

            case 'remove_cut':
                // Reapply remove_cut: remove the cut
                {
                    const newCuts = cuts.filter(c => 
                        c.start !== action.cut.start || c.end !== action.cut.end
                    );
                    setCuts(newCuts);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                cuts: newCuts,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;

            case 'add_speed_ramp':
                // Reapply add_speed_ramp: add the speed ramp
                {
                    const newRamps = [...speedRamps, action.ramp].sort((a, b) => a.range.start - b.range.start);
                    setSpeedRamps(newRamps);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                speedRamps: newRamps,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;

            case 'update_speed_ramp':
                // Reapply update_speed_ramp: apply the 'after' state
                {
                    const newRamps = speedRamps.map(r => 
                        r.range.start === action.before.range.start && 
                        r.range.end === action.before.range.end
                            ? action.after
                            : r
                    );
                    setSpeedRamps(newRamps);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                speedRamps: newRamps,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;

            case 'remove_speed_ramp':
                // Reapply remove_speed_ramp: remove the speed ramp
                {
                    const newRamps = speedRamps.filter(r => 
                        r.range.start !== action.ramp.range.start || 
                        r.range.end !== action.ramp.range.end
                    );
                    setSpeedRamps(newRamps);
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                speedRamps: newRamps,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
                break;
        }

        // Trigger re-render to update undo/redo button states
        setUndoRedoTrigger(prev => prev + 1);
    }, [undoManager, selectedMarkerId, cuts, speedRamps, project, onProjectUpdate]);

    // Sync local camera bubble position when project changes
    // Validates: Requirement 4.3
    useEffect(() => {
        if (project.editSettings.cameraBubblePosition) {
            setLocalCameraBubblePosition(project.editSettings.cameraBubblePosition);
        }
    }, [project.editSettings.cameraBubblePosition]);

    // Sync trim points when project changes
    // Validates: Requirements 2.2, 2.3
    useEffect(() => {
        setInPoint(project.editSettings.inPoint ?? 0);
        setOutPoint(project.editSettings.outPoint ?? project.duration);
    }, [project.editSettings.inPoint, project.editSettings.outPoint, project.duration]);

    // Sync cuts when project changes
    // Validates: Requirement 3.1
    useEffect(() => {
        setCuts(project.editSettings.cuts ?? []);
    }, [project.editSettings.cuts]);

    // Sync speed ramps when project changes
    // Validates: Requirements 4.1, 4.2, 4.3
    useEffect(() => {
        setSpeedRamps(project.editSettings.speedRamps ?? []);
    }, [project.editSettings.speedRamps]);

    // Load video blobs and wait for metadata
    useEffect(() => {
        const video = videoRef.current;
        console.log('[EditView] Video loading effect triggered');
        console.log('[EditView] video element:', !!video);
        console.log('[EditView] project.videoBlob:', !!project.videoBlob, 'size:', project.videoBlob?.size);

        if (!video || !project.videoBlob) return;

        const url = URL.createObjectURL(project.videoBlob);
        video.src = url;
        console.log('[EditView] Created object URL:', url);

        const handleLoadedMetadata = () => {
            console.log('[EditView] Video metadata loaded successfully');
            setIsVideoReady(true);
            // Draw first frame
            renderFrame();
        };

        const handleError = (e: Event) => {
            console.error('[EditView] Video load error:', e);
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('error', handleError);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('error', handleError);
            URL.revokeObjectURL(url);
        };
    }, [project.videoBlob]);

    // Load camera video
    useEffect(() => {
        const camera = cameraRef.current;
        if (!camera || !project.cameraBlob) {
            return;
        }

        // Skip if blob is empty or too small
        if (project.cameraBlob.size < 1000) {
            return;
        }

        const url = URL.createObjectURL(project.cameraBlob);
        camera.src = url;
        camera.muted = true;

        const handleLoaded = () => {
            // Auto-play muted video
            camera.play().catch(() => { });
        };

        const handleError = () => {
            // Camera video failed to load - silently ignore
        };

        camera.addEventListener('loadeddata', handleLoaded);
        camera.addEventListener('error', handleError);

        // Trigger load
        camera.load();

        return () => {
            camera.removeEventListener('loadeddata', handleLoaded);
            camera.removeEventListener('error', handleError);
            URL.revokeObjectURL(url);
        };
    }, [project.cameraBlob]);

    // Sync camera with main video playback
    // Use tighter sync tolerance for better audio/video alignment
    useEffect(() => {
        const video = videoRef.current;
        const camera = cameraRef.current;
        if (!video || !camera || !project.cameraBlob) return;

        const syncCamera = () => {
            // Tighter sync tolerance: 50ms instead of 100ms
            if (Math.abs(camera.currentTime - video.currentTime) > 0.05) {
                camera.currentTime = video.currentTime;
            }
        };

        const handlePlay = () => {
            // Sync before playing to ensure alignment
            camera.currentTime = video.currentTime;
            camera.play().catch(() => { });
        };

        const handlePause = () => {
            camera.pause();
            // Re-sync on pause
            camera.currentTime = video.currentTime;
        };

        const handleSeeking = () => {
            // Sync immediately when user seeks
            camera.currentTime = video.currentTime;
        };

        // Periodic sync check during playback to prevent drift
        let syncInterval: number | null = null;
        const handlePlaying = () => {
            // Check sync every 500ms during playback
            syncInterval = window.setInterval(() => {
                if (!video.paused && !camera.paused) {
                    syncCamera();
                }
            }, 500);
        };

        const handleEnded = () => {
            if (syncInterval) {
                clearInterval(syncInterval);
                syncInterval = null;
            }
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('seeked', syncCamera);
        video.addEventListener('seeking', handleSeeking);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('seeked', syncCamera);
            video.removeEventListener('seeking', handleSeeking);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('ended', handleEnded);
            if (syncInterval) {
                clearInterval(syncInterval);
            }
        };
    }, [project.cameraBlob]);

    // Load microphone audio
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !project.audioBlob) {
            console.log('[EditView] No audio blob to load');
            return;
        }

        console.log('[EditView] Loading audio blob, size:', project.audioBlob.size);
        const url = URL.createObjectURL(project.audioBlob);
        audio.src = url;

        const handleLoaded = () => {
            console.log('[EditView] Audio loaded successfully');
        };

        const handleError = (e: Event) => {
            console.error('[EditView] Audio load error:', e);
        };

        audio.addEventListener('loadeddata', handleLoaded);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('loadeddata', handleLoaded);
            audio.removeEventListener('error', handleError);
            URL.revokeObjectURL(url);
        };
    }, [project.audioBlob]);

    // Sync audio with main video playback
    // Use tighter sync tolerance for better audio/video alignment
    useEffect(() => {
        const video = videoRef.current;
        const audio = audioRef.current;
        if (!video || !audio || !project.audioBlob) return;

        const syncAudio = () => {
            // Tighter sync tolerance: 50ms instead of 100ms
            if (Math.abs(audio.currentTime - video.currentTime) > 0.05) {
                audio.currentTime = video.currentTime;
            }
        };

        const handlePlay = () => {
            // Sync before playing to ensure alignment
            audio.currentTime = video.currentTime;
            audio.play().catch((e) => {
                console.error('[EditView] Audio play failed:', e);
            });
        };

        const handlePause = () => {
            audio.pause();
            // Re-sync on pause
            audio.currentTime = video.currentTime;
        };

        const handleSeeking = () => {
            // Sync immediately when user seeks
            audio.currentTime = video.currentTime;
        };

        // Periodic sync check during playback to prevent drift
        let syncInterval: number | null = null;
        const handlePlaying = () => {
            // Check sync every 500ms during playback
            syncInterval = window.setInterval(() => {
                if (!video.paused && !audio.paused) {
                    syncAudio();
                }
            }, 500);
        };

        const handleEnded = () => {
            if (syncInterval) {
                clearInterval(syncInterval);
                syncInterval = null;
            }
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('seeked', syncAudio);
        video.addEventListener('seeking', handleSeeking);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('seeked', syncAudio);
            video.removeEventListener('seeking', handleSeeking);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('ended', handleEnded);
            if (syncInterval) {
                clearInterval(syncInterval);
            }
        };
    }, [project.audioBlob]);

    // Process signals when engine is ready
    useEffect(() => {
        if (!isLoading && !error && !analysisResult) {
            const result = processSignals(project.signals);
            if (result) {
                setAnalysisResult(result);
                // Note: We don't populate zoomMarkers from auto-generated keyframes.
                // The timeline markers are for manual keyframes only.
                // Auto-generated keyframes are used internally for interpolation
                // but users add their own markers via "Add a segment" button.
            }
        }
    }, [isLoading, error, analysisResult, processSignals, project.signals]);

    // Render frame to canvas using compositor with viewport interpolation
    // Validates: Requirement 1.7 - Preview SHALL update in real-time to show new zoom behavior
    const renderFrame = useCallback(() => {
        const video = videoRef.current;
        const camera = cameraRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Skip if video not ready
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            return;
        }

        // Get current timestamp in microseconds
        const timestampUs = video.currentTime * 1_000_000;

        // Get effect tracks and cursor track from analysis result
        const effectTracks = analysisResult?.effect_tracks?.effects ?? [];
        const cursorTrack = analysisResult?.cursor_track ?? [];

        // Use the interpolateViewportFromZoomSegments function which automatically
        // follows the recorded cursor position during playback
        const viewport = interpolateViewportCombined(
            zoomSegments,
            zoomMarkers,
            timestampUs,
            cursorTrack  // Pass cursor track for automatic cursor following
        );

        // Find active effects at this timestamp
        const activeEffects = findActiveEffects(effectTracks, timestampUs);

        // Create compositor config from edit settings
        const compositorConfig = createConfigFromEditSettings(
            canvas.width,
            canvas.height,
            project.editSettings
        );

        // Override camera bubble position with local position for real-time drag feedback
        compositorConfig.cameraBubble.position = localCameraBubblePosition;

        // Create compositor and render frame
        // Pass null for cursor to disable rendered cursor - we track the real cursor instead
        const compositor = new CanvasCompositor(ctx, compositorConfig);
        compositor.renderFrame(
            video,
            {
                timestamp_us: timestampUs,
                viewport,
                activeEffects,
                cursorPosition: null,  // Disabled - tracking real cursor instead
                cursorOpacity: 0,
            },
            camera && project.cameraBlob && camera.readyState >= 2 ? camera : undefined
        );
    }, [zoomMarkers, zoomSegments, analysisResult, project.editSettings, project.cameraBlob, localCameraBubblePosition]);

    /**
     * Checks if a timestamp is within any cut segment and returns the cut's end time if so.
     * Returns null if the timestamp is not within a cut segment.
     * Validates: Requirement 3.7 - Preview SHALL skip over cut segments
     */
    const findCutEndTime = useCallback(
        (timestampUs: number): number | null => {
            for (const cut of cuts) {
                if (timestampUs >= cut.start && timestampUs < cut.end) {
                    return cut.end;
                }
            }
            return null;
        },
        [cuts]
    );

    /**
     * Gets the playback speed at a given timestamp based on speed ramps.
     * Returns 1.0 if no speed ramp is active at this timestamp.
     * Validates: Requirements 4.5, 4.8 - Time remapper accounts for speed changes
     */
    const getSpeedAtTime = useCallback(
        (timestampUs: number): number => {
            for (const ramp of speedRamps) {
                if (timestampUs >= ramp.range.start && timestampUs < ramp.range.end) {
                    return ramp.speed;
                }
            }
            return 1.0;
        },
        [speedRamps]
    );

    // Animation loop for playback
    // Validates: Requirement 3.7 - WHEN playing back, THE preview SHALL skip over cut segments
    // Validates: Requirements 4.5, 4.8 - Speed ramps affect playback speed
    useEffect(() => {
        const video = videoRef.current;
        const camera = cameraRef.current;
        const audio = audioRef.current;
        if (!video || !isVideoReady) return;

        const animate = () => {
            const currentTimeUs = video.currentTime * 1_000_000;
            
            // Check if current position is within a cut segment
            // If so, skip to the end of the cut segment
            // Validates: Requirement 3.7
            const cutEndTime = findCutEndTime(currentTimeUs);
            if (cutEndTime !== null) {
                // Skip to the end of the cut segment
                const newTimeSeconds = cutEndTime / 1_000_000;
                video.currentTime = newTimeSeconds;
                
                // Sync camera and audio to the new position
                if (camera) {
                    camera.currentTime = newTimeSeconds;
                }
                if (audio) {
                    audio.currentTime = newTimeSeconds;
                }
                
                setCurrentTime(cutEndTime);
            } else {
                setCurrentTime(currentTimeUs);
            }
            
            // Apply speed ramp to video playback rate
            // Validates: Requirements 4.5, 4.8 - Time remapper accounts for speed changes
            const speed = getSpeedAtTime(currentTimeUs);
            if (video.playbackRate !== speed) {
                video.playbackRate = speed;
                // Sync camera playback rate
                if (camera) {
                    camera.playbackRate = speed;
                }
            }
            
            // Handle audio during speed ramps
            // Validates: Requirement 4.6 - WHEN audio is sped up beyond 2x, THE system SHALL optionally mute the audio
            // Audio handling is separate from video playback rate to ensure proper synchronization
            if (audio) {
                // Use utility function to determine if audio should be muted
                // This prevents distorted/chipmunk audio at high playback speeds (>2x)
                const shouldMute = shouldMuteAudioAtSpeed(speed);
                
                if (shouldMute) {
                    // Mute audio for speeds > 2x
                    if (!audio.muted) {
                        audio.muted = true;
                    }
                } else {
                    // For speeds <= 2x, adjust playback rate and unmute
                    if (audio.muted) {
                        audio.muted = false;
                    }
                    // Use utility function to get the appropriate audio playback rate
                    // This keeps audio in sync with the video during speed ramps
                    const audioRate = getAudioPlaybackRate(speed);
                    if (audio.playbackRate !== audioRate) {
                        audio.playbackRate = audioRate;
                    }
                }
                
                // Ensure audio stays synchronized with video during speed changes
                // Re-sync if audio drifts more than 50ms from video (tighter tolerance)
                const audioDrift = Math.abs(audio.currentTime - video.currentTime);
                if (audioDrift > 0.05 && !shouldMute) {
                    audio.currentTime = video.currentTime;
                }
            }
            
            // Ensure camera stays synchronized with video
            if (camera) {
                const cameraDrift = Math.abs(camera.currentTime - video.currentTime);
                if (cameraDrift > 0.05) {
                    camera.currentTime = video.currentTime;
                }
            }
            
            renderFrame();

            if (!video.paused && !video.ended) {
                animationRef.current = requestAnimationFrame(animate);
            }
        };

        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            // Reset playback rate when stopping
            if (video) {
                video.playbackRate = 1.0;
            }
            if (camera) {
                camera.playbackRate = 1.0;
            }
            if (audio) {
                audio.playbackRate = 1.0;
                audio.muted = false;
            }
        };
    }, [isPlaying, isVideoReady, renderFrame, findCutEndTime, getSpeedAtTime]);

    // Re-render preview when keyframes are modified (real-time preview update)
    // Also re-render when mouse position changes while in a zoom segment
    // Validates: Requirement 1.7 - Preview SHALL update in real-time to show new zoom behavior
    useEffect(() => {
        if (isVideoReady && !isPlaying) {
            // Only re-render when paused to avoid interfering with playback animation
            renderFrame();
        }
    }, [zoomMarkers, zoomSegments, mousePosition, isVideoReady, isPlaying, renderFrame]);

    // Sync video playback events
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
        };
    }, []);

    // Keyboard shortcut handler for Delete key to remove selected cut or speed ramp
    // Validates: Requirement 3.4 - User can remove a cut segment (restore the content)
    // Validates: Requirement 4.3 - User can adjust/remove speed ramp segments
    // Validates: Requirement 5.2 - Ctrl/Cmd+Z for undo
    // Validates: Requirement 5.3 - Ctrl/Cmd+Shift+Z for redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo: Ctrl/Cmd+Z (without Shift)
            // Validates: Requirement 5.2 - THE user SHALL be able to undo the last action using Ctrl/Cmd+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
                return;
            }
            
            // Redo: Ctrl/Cmd+Shift+Z
            // Validates: Requirement 5.3 - THE user SHALL be able to redo an undone action using Ctrl/Cmd+Shift+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                handleRedo();
                return;
            }
            
            // Delete or Backspace key removes selected cut or speed ramp
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Priority: selected cut first, then selected speed ramp
                if (selectedCutIndex !== null) {
                    // Prevent default browser behavior (e.g., navigating back)
                    e.preventDefault();
                    
                    // Get the cut being removed for undo recording
                    const cutToRemove = cuts[selectedCutIndex];
                    
                    // Remove the selected cut
                    const newCuts = cuts.filter((_, index) => index !== selectedCutIndex);
                    setCuts(newCuts);
                    setSelectedCutIndex(null);
                    
                    // Record action for undo - Requirement 5.4
                    recordAction({ type: 'remove_cut', cut: cutToRemove });
                    
                    // Persist to project settings
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                cuts: newCuts,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                } else if (selectedRampIndex !== null) {
                    // Prevent default browser behavior
                    e.preventDefault();
                    
                    // Get the speed ramp being removed for undo recording
                    const rampToRemove = speedRamps[selectedRampIndex];
                    
                    // Remove the selected speed ramp
                    const newRamps = speedRamps.filter((_, index) => index !== selectedRampIndex);
                    setSpeedRamps(newRamps);
                    setSelectedRampIndex(null);
                    
                    // Record action for undo - Requirement 5.4
                    recordAction({ type: 'remove_speed_ramp', ramp: rampToRemove });
                    
                    // Persist to project settings
                    if (onProjectUpdate) {
                        const updatedProject: Project = {
                            ...project,
                            editSettings: {
                                ...project.editSettings,
                                speedRamps: newRamps,
                            },
                        };
                        onProjectUpdate(updatedProject);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedCutIndex, cuts, selectedRampIndex, speedRamps, project, onProjectUpdate, recordAction, handleUndo, handleRedo]);

    const handlePlayPause = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }, []);

    const handleSeek = useCallback(
        (timeUs: number) => {
            const video = videoRef.current;
            if (video) {
                video.currentTime = timeUs / 1000000;
                setCurrentTime(timeUs);
                // Draw frame at new position
                setTimeout(renderFrame, 50);
            }
            if (cameraRef.current) {
                cameraRef.current.currentTime = timeUs / 1000000;
            }
            if (audioRef.current) {
                audioRef.current.currentTime = timeUs / 1000000;
            }
        },
        [renderFrame]
    );

    const handleMarkerSelect = useCallback(
        (markerId: string) => {
            setSelectedMarkerId(markerId);
            const marker = zoomMarkers.find((m) => m.id === markerId);
            if (marker) {
                handleSeek(marker.timestamp);
            }
        },
        [zoomMarkers, handleSeek]
    );

    const handleMarkerUpdate = useCallback(
        (markerId: string, updates: Partial<ZoomMarker>) => {
            // Find the marker before updating for undo recording
            const beforeMarker = zoomMarkers.find((m) => m.id === markerId);
            
            setZoomMarkers((prev) =>
                prev.map((m) => (m.id === markerId ? { ...m, ...updates } : m))
            );
            
            // Record action for undo - Requirement 5.4
            if (beforeMarker) {
                const afterMarker = { ...beforeMarker, ...updates };
                recordAction({ 
                    type: 'update_keyframe', 
                    id: markerId, 
                    before: beforeMarker, 
                    after: afterMarker 
                });
            }
        },
        [zoomMarkers, recordAction]
    );

    // Handler for when a marker's timestamp is changed via drag (Requirement 1.5)
    const handleMarkerTimestampChange = useCallback(
        (markerId: string, newTimestamp: number) => {
            // Find the marker before updating for undo recording
            const beforeMarker = zoomMarkers.find((m) => m.id === markerId);
            
            setZoomMarkers((prev) =>
                prev
                    .map((m) => (m.id === markerId ? { ...m, timestamp: newTimestamp } : m))
                    .sort((a, b) => a.timestamp - b.timestamp)
            );
            
            // Record action for undo - Requirement 5.4
            if (beforeMarker) {
                const afterMarker = { ...beforeMarker, timestamp: newTimestamp };
                recordAction({ 
                    type: 'update_keyframe', 
                    id: markerId, 
                    before: beforeMarker, 
                    after: afterMarker 
                });
            }
        },
        [zoomMarkers, recordAction]
    );

    // Handle adding a zoom segment - creates a draggable zoom region
    const handleAddZoomSegment = useCallback(() => {
        if (zoomSegmentInProgress === null) {
            // Start creating a new zoom segment
            setZoomSegmentInProgress(currentTime);
        } else {
            // Complete the zoom segment
            const start = Math.min(zoomSegmentInProgress, currentTime);
            const end = Math.max(zoomSegmentInProgress, currentTime);
            
            // Ensure minimum duration of 500ms
            if (end - start < 500000) {
                // If too short, create a 1 second segment centered on the click
                const center = (start + end) / 2;
                const halfDuration = 500000;
                const newSegment: ZoomSegment = {
                    id: `zoom-${Date.now()}`,
                    start: Math.max(0, center - halfDuration),
                    end: Math.min(project.duration, center + halfDuration),
                    zoomLevel: pendingZoomLevel,
                    position: { x: 0.5, y: 0.5 },
                };
                setZoomSegments(prev => [...prev, newSegment].sort((a, b) => a.start - b.start));
                setSelectedZoomSegmentIndex(zoomSegments.length);
            } else {
                const newSegment: ZoomSegment = {
                    id: `zoom-${Date.now()}`,
                    start,
                    end,
                    zoomLevel: pendingZoomLevel,
                    position: { x: 0.5, y: 0.5 },
                };
                setZoomSegments(prev => [...prev, newSegment].sort((a, b) => a.start - b.start));
                setSelectedZoomSegmentIndex(zoomSegments.length);
            }
            
            setZoomSegmentInProgress(null);
        }
    }, [currentTime, zoomSegmentInProgress, pendingZoomLevel, project.duration, zoomSegments.length]);

    // Handle zoom segment selection
    const handleZoomSegmentSelect = useCallback((index: number) => {
        setSelectedZoomSegmentIndex(index);
        setSelectedMarkerId(null);
        setSelectedCutIndex(null);
        setSelectedRampIndex(null);
    }, []);

    // Handle zoom segment update (drag/resize)
    const handleZoomSegmentUpdate = useCallback((index: number, segment: ZoomSegment) => {
        setZoomSegments(prev => {
            const newSegments = [...prev];
            newSegments[index] = segment;
            return newSegments.sort((a, b) => a.start - b.start);
        });
    }, []);

    // Handle zoom segment deletion
    const handleDeleteZoomSegment = useCallback((index: number) => {
        setZoomSegments(prev => prev.filter((_, i) => i !== index));
        if (selectedZoomSegmentIndex === index) {
            setSelectedZoomSegmentIndex(null);
        }
    }, [selectedZoomSegmentIndex]);

    // Handle zoom level change for selected segment
    const handleZoomSegmentLevelChange = useCallback((zoomLevel: number) => {
        if (selectedZoomSegmentIndex !== null) {
            setZoomSegments(prev => {
                const newSegments = [...prev];
                newSegments[selectedZoomSegmentIndex] = {
                    ...newSegments[selectedZoomSegmentIndex],
                    zoomLevel,
                };
                return newSegments;
            });
        }
    }, [selectedZoomSegmentIndex]);

    const handleDeleteMarker = useCallback(
        (markerId: string) => {
            // Find the marker before deleting for undo recording
            const markerToDelete = zoomMarkers.find((m) => m.id === markerId);
            
            setZoomMarkers((prev) => prev.filter((m) => m.id !== markerId));
            if (selectedMarkerId === markerId) {
                setSelectedMarkerId(null);
            }
            
            // Record action for undo - Requirement 5.4
            if (markerToDelete) {
                recordAction({ type: 'delete_keyframe', keyframe: markerToDelete });
            }
        },
        [selectedMarkerId, zoomMarkers, recordAction]
    );

    /**
     * Handles gradient selection from the sidebar.
     * Updates project.editSettings.backgroundGradient and notifies parent.
     * Validates: Requirement 1.4
     */
    const handleGradientSelect = useCallback(
        (gradientId: string) => {
            if (onProjectUpdate) {
                const updatedProject: Project = {
                    ...project,
                    editSettings: {
                        ...project.editSettings,
                        backgroundGradient: gradientId,
                    },
                };
                onProjectUpdate(updatedProject);
            }
        },
        [project, onProjectUpdate]
    );

    /**
     * Handles shadow toggle from the sidebar.
     * Updates project.editSettings.screenShadowEnabled and notifies parent.
     * Validates: Requirement 2.6
     */
    const handleShadowToggle = useCallback(
        (enabled: boolean) => {
            if (onProjectUpdate) {
                const updatedProject: Project = {
                    ...project,
                    editSettings: {
                        ...project.editSettings,
                        screenShadowEnabled: enabled,
                    },
                };
                onProjectUpdate(updatedProject);
            }
        },
        [project, onProjectUpdate]
    );

    /**
     * Handles device frame selection from the sidebar.
     * Updates project.editSettings.deviceFrame and notifies parent.
     * Validates: Requirement 3.6
     */
    const handleDeviceFrameSelect = useCallback(
        (frameType: 'none' | 'browser' | 'macbook') => {
            if (onProjectUpdate) {
                const updatedProject: Project = {
                    ...project,
                    editSettings: {
                        ...project.editSettings,
                        deviceFrame: frameType,
                    },
                };
                onProjectUpdate(updatedProject);
            }
        },
        [project, onProjectUpdate]
    );

    /**
     * Handles camera bubble size change from the sidebar slider.
     * Clamps size to valid range (0.1-0.4) and updates project.editSettings.
     * Validates: Requirement 4.2
     */
    const handleCameraBubbleSizeChange = useCallback(
        (size: number) => {
            const clampedSize = clampCameraBubbleSize(size);
            if (onProjectUpdate) {
                const updatedProject: Project = {
                    ...project,
                    editSettings: {
                        ...project.editSettings,
                        cameraBubbleSize: clampedSize,
                    },
                };
                onProjectUpdate(updatedProject);
            }
        },
        [project, onProjectUpdate]
    );

    /**
     * Handles camera bubble shape selection from the sidebar.
     * Updates project.editSettings.cameraBubbleShape and notifies parent.
     * Validates: Requirement 4.5
     */
    const handleCameraBubbleShapeChange = useCallback(
        (shape: 'circle' | 'rounded-rect') => {
            if (onProjectUpdate) {
                const updatedProject: Project = {
                    ...project,
                    editSettings: {
                        ...project.editSettings,
                        cameraBubbleShape: shape,
                    },
                };
                onProjectUpdate(updatedProject);
            }
        },
        [project, onProjectUpdate]
    );

    /**
     * Handles camera background blur intensity change from the sidebar slider.
     * Clamps blur to valid range (0-20) and updates project.editSettings.
     * 0 = disabled, 1-20 = blur radius in pixels.
     * Validates: Requirements 5.3, 5.4
     */
    const handleCameraBackgroundBlurChange = useCallback(
        (blur: number) => {
            const clampedBlur = clampBackgroundBlur(blur);
            if (onProjectUpdate) {
                const updatedProject: Project = {
                    ...project,
                    editSettings: {
                        ...project.editSettings,
                        cameraBackgroundBlur: clampedBlur,
                    },
                };
                onProjectUpdate(updatedProject);
            }
        },
        [project, onProjectUpdate]
    );

    /**
     * Handles in point (start trim) change from the TrimHandles component.
     * Clamps to valid range: 0 <= inPoint < outPoint
     * Validates: Requirement 2.2 - User can drag start trim handle to set In_Point
     */
    const handleInPointChange = useCallback(
        (time: number) => {
            // Clamp to valid range: 0 <= inPoint < outPoint
            const clampedTime = Math.max(0, Math.min(outPoint - 1, time));
            
            // Record action for undo - Requirement 5.4
            recordAction({ 
                type: 'set_trim', 
                before: { start: inPoint, end: outPoint }, 
                after: { start: clampedTime, end: outPoint } 
            });
            
            setInPoint(clampedTime);
            
            // Persist to project settings
            if (onProjectUpdate) {
                const updatedProject: Project = {
                    ...project,
                    editSettings: {
                        ...project.editSettings,
                        inPoint: clampedTime,
                    },
                };
                onProjectUpdate(updatedProject);
            }
        },
        [outPoint, inPoint, project, onProjectUpdate, recordAction]
    );

    /**
     * Handles out point (end trim) change from the TrimHandles component.
     * Clamps to valid range: inPoint < outPoint <= duration
     * Validates: Requirement 2.3 - User can drag end trim handle to set Out_Point
     */
    const handleOutPointChange = useCallback(
        (time: number) => {
            // Clamp to valid range: inPoint < outPoint <= duration
            const clampedTime = Math.max(inPoint + 1, Math.min(project.duration, time));
            
            // Record action for undo - Requirement 5.4
            recordAction({ 
                type: 'set_trim', 
                before: { start: inPoint, end: outPoint }, 
                after: { start: inPoint, end: clampedTime } 
            });
            
            setOutPoint(clampedTime);
            
            // Persist to project settings
            if (onProjectUpdate) {
                const updatedProject: Project = {
                    ...project,
                    editSettings: {
                        ...project.editSettings,
                        outPoint: clampedTime,
                    },
                };
                onProjectUpdate(updatedProject);
            }
        },
        [inPoint, outPoint, project, onProjectUpdate, recordAction]
    );

    /**
     * Handles trim reset button click.
     * Resets in-point to 0 and out-point to full video duration.
     * Validates: Requirement 2.7 - User can reset trim points to include full video
     */
    const handleTrimReset = useCallback(() => {
        // Record action for undo - Requirement 5.4
        recordAction({ 
            type: 'set_trim', 
            before: { start: inPoint, end: outPoint }, 
            after: { start: 0, end: project.duration } 
        });
        
        // Reset to full video duration
        setInPoint(0);
        setOutPoint(project.duration);
        
        // Persist to project settings
        if (onProjectUpdate) {
            const updatedProject: Project = {
                ...project,
                editSettings: {
                    ...project.editSettings,
                    inPoint: 0,
                    outPoint: project.duration,
                },
            };
            onProjectUpdate(updatedProject);
        }
    }, [project, onProjectUpdate, inPoint, outPoint, recordAction]);

    /**
     * Validates that a new cut segment doesn't overlap with existing cuts.
     * Returns true if the cut is valid (no overlap), false otherwise.
     * Validates: Design doc - Error Handling: Overlapping cuts should be merged
     */
    const validateCutNoOverlap = useCallback(
        (newCut: TimeRange, existingCuts: TimeRange[]): boolean => {
            for (const cut of existingCuts) {
                // Check if ranges overlap
                // Two ranges overlap if one starts before the other ends and vice versa
                if (newCut.start < cut.end && newCut.end > cut.start) {
                    return false;
                }
            }
            return true;
        },
        []
    );

    /**
     * Merges overlapping cuts into a single cut.
     * Used when a new cut overlaps with existing cuts.
     */
    const mergeCuts = useCallback(
        (cutsToMerge: TimeRange[]): TimeRange[] => {
            if (cutsToMerge.length === 0) return [];
            
            // Sort by start time
            const sorted = [...cutsToMerge].sort((a, b) => a.start - b.start);
            const merged: TimeRange[] = [sorted[0]];
            
            for (let i = 1; i < sorted.length; i++) {
                const current = sorted[i];
                const last = merged[merged.length - 1];
                
                // If current overlaps with last, merge them
                if (current.start <= last.end) {
                    last.end = Math.max(last.end, current.end);
                } else {
                    merged.push(current);
                }
            }
            
            return merged;
        },
        []
    );

    /**
     * Handles setting the cut-in point (start of cut segment).
     * Sets the current playhead position as the cut-in point.
     * Validates: Requirement 3.1 - User can mark a segment for removal by setting cut-in and cut-out points
     */
    const handleSetCutIn = useCallback(() => {
        setCutInProgress(currentTime);
        // Deselect any selected cut when starting a new cut
        setSelectedCutIndex(null);
    }, [currentTime]);

    /**
     * Handles setting the cut-out point (end of cut segment).
     * Creates a new cut segment from the cut-in point to the current playhead position.
     * Validates: Requirement 3.1 - User can mark a segment for removal by setting cut-in and cut-out points
     */
    const handleSetCutOut = useCallback(() => {
        if (cutInProgress === null) return;
        
        // Ensure cut-out is after cut-in
        const cutStart = Math.min(cutInProgress, currentTime);
        const cutEnd = Math.max(cutInProgress, currentTime);
        
        // Don't create zero-length cuts
        if (cutEnd <= cutStart) {
            setCutInProgress(null);
            return;
        }
        
        const newCut: TimeRange = { start: cutStart, end: cutEnd };
        
        // Check for overlaps and merge if necessary
        let newCuts: TimeRange[];
        if (validateCutNoOverlap(newCut, cuts)) {
            // No overlap, just add the new cut
            newCuts = [...cuts, newCut].sort((a, b) => a.start - b.start);
        } else {
            // Overlap detected, merge cuts
            newCuts = mergeCuts([...cuts, newCut]);
        }
        
        setCuts(newCuts);
        setCutInProgress(null);
        
        // Record action for undo - Requirement 5.4
        recordAction({ type: 'add_cut', cut: newCut });
        
        // Persist to project settings
        if (onProjectUpdate) {
            const updatedProject: Project = {
                ...project,
                editSettings: {
                    ...project.editSettings,
                    cuts: newCuts,
                },
            };
            onProjectUpdate(updatedProject);
        }
    }, [cutInProgress, currentTime, cuts, validateCutNoOverlap, mergeCuts, project, onProjectUpdate, recordAction]);

    /**
     * Handles canceling the current cut creation workflow.
     * Clears the cut-in point without creating a cut.
     */
    const handleCancelCut = useCallback(() => {
        setCutInProgress(null);
    }, []);

    /**
     * Handles selecting a cut segment.
     * Validates: Requirement 3.4 - User can click to select cut segment
     */
    const handleCutSelect = useCallback((index: number) => {
        setSelectedCutIndex(index);
    }, []);

    /**
     * Handles removing a cut segment (restoring the content).
     * Validates: Requirement 3.4 - User can remove a cut segment (restore the content)
     */
    const handleRemoveCut = useCallback(() => {
        if (selectedCutIndex === null || selectedCutIndex >= cuts.length) return;
        
        // Get the cut being removed for undo recording
        const cutToRemove = cuts[selectedCutIndex];
        
        const newCuts = cuts.filter((_, index) => index !== selectedCutIndex);
        setCuts(newCuts);
        setSelectedCutIndex(null);
        
        // Record action for undo - Requirement 5.4
        recordAction({ type: 'remove_cut', cut: cutToRemove });
        
        // Persist to project settings
        if (onProjectUpdate) {
            const updatedProject: Project = {
                ...project,
                editSettings: {
                    ...project.editSettings,
                    cuts: newCuts,
                },
            };
            onProjectUpdate(updatedProject);
        }
    }, [selectedCutIndex, cuts, project, onProjectUpdate, recordAction]);

    // =========================================================================
    // Speed Ramp Handlers - Requirements 4.1, 4.2, 4.3
    // =========================================================================

    /**
     * Validates that a new speed ramp doesn't overlap with existing speed ramps.
     * Returns true if the ramp is valid (no overlap), false otherwise.
     * Validates: Design doc - Error Handling: Overlapping speed ramps should be handled
     */
    const validateRampNoOverlap = useCallback(
        (newRamp: TimeRange, existingRamps: SpeedRamp[]): boolean => {
            for (const ramp of existingRamps) {
                // Check if ranges overlap
                if (newRamp.start < ramp.range.end && newRamp.end > ramp.range.start) {
                    return false;
                }
            }
            return true;
        },
        []
    );

    /**
     * Handles setting the speed ramp start point.
     * Sets the current playhead position as the speed ramp start point.
     * Validates: Requirement 4.1 - User can create a speed ramp segment on the timeline
     */
    const handleSetRampStart = useCallback(() => {
        setRampInProgress({ start: currentTime, speed: pendingRampSpeed });
        // Deselect any selected speed ramp when starting a new one
        setSelectedRampIndex(null);
    }, [currentTime, pendingRampSpeed]);

    /**
     * Handles setting the speed ramp end point.
     * Creates a new speed ramp from the start point to the current playhead position.
     * Validates: Requirement 4.1 - User can create a speed ramp segment on the timeline
     */
    const handleSetRampEnd = useCallback(() => {
        if (rampInProgress === null) return;
        
        // Ensure end is after start
        const rampStart = Math.min(rampInProgress.start, currentTime);
        const rampEnd = Math.max(rampInProgress.start, currentTime);
        
        // Don't create zero-length ramps
        if (rampEnd <= rampStart) {
            setRampInProgress(null);
            return;
        }
        
        const newRange: TimeRange = { start: rampStart, end: rampEnd };
        
        // Check for overlaps
        if (!validateRampNoOverlap(newRange, speedRamps)) {
            // Overlap detected - alert user and cancel
            alert('Speed ramp overlaps with an existing speed ramp. Please choose a different range.');
            setRampInProgress(null);
            return;
        }
        
        const newRamp: SpeedRamp = {
            range: newRange,
            speed: rampInProgress.speed,
        };
        
        const newRamps = [...speedRamps, newRamp].sort((a, b) => a.range.start - b.range.start);
        setSpeedRamps(newRamps);
        setRampInProgress(null);
        
        // Record action for undo - Requirement 5.4
        recordAction({ type: 'add_speed_ramp', ramp: newRamp });
        
        // Persist to project settings
        if (onProjectUpdate) {
            const updatedProject: Project = {
                ...project,
                editSettings: {
                    ...project.editSettings,
                    speedRamps: newRamps,
                },
            };
            onProjectUpdate(updatedProject);
        }
    }, [rampInProgress, currentTime, speedRamps, validateRampNoOverlap, project, onProjectUpdate, recordAction]);

    /**
     * Handles canceling the current speed ramp creation workflow.
     * Clears the start point without creating a speed ramp.
     */
    const handleCancelRamp = useCallback(() => {
        setRampInProgress(null);
    }, []);

    /**
     * Handles selecting a speed ramp segment.
     * Validates: Requirement 4.3 - User can adjust the speed of a selected speed ramp segment
     */
    const handleRampSelect = useCallback((index: number) => {
        setSelectedRampIndex(index);
        // Deselect cut when selecting a speed ramp
        setSelectedCutIndex(null);
    }, []);

    /**
     * Handles updating the speed of a selected speed ramp.
     * Validates: Requirement 4.3 - User can adjust the speed of a selected speed ramp segment
     * Validates: Requirement 4.2 - Speed ramp supports speeds from 0.25x to 4x
     */
    const handleRampSpeedChange = useCallback((newSpeed: number) => {
        if (selectedRampIndex === null || selectedRampIndex >= speedRamps.length) return;
        
        // Clamp speed to valid range (0.25x to 4x)
        const clampedSpeed = Math.max(0.25, Math.min(4, newSpeed));
        
        // Get the ramp before updating for undo recording
        const beforeRamp = speedRamps[selectedRampIndex];
        
        const newRamps = speedRamps.map((ramp, index) => 
            index === selectedRampIndex 
                ? { ...ramp, speed: clampedSpeed }
                : ramp
        );
        
        setSpeedRamps(newRamps);
        
        // Record action for undo - Requirement 5.4
        const afterRamp = { ...beforeRamp, speed: clampedSpeed };
        recordAction({ type: 'update_speed_ramp', before: beforeRamp, after: afterRamp });
        
        // Persist to project settings
        if (onProjectUpdate) {
            const updatedProject: Project = {
                ...project,
                editSettings: {
                    ...project.editSettings,
                    speedRamps: newRamps,
                },
            };
            onProjectUpdate(updatedProject);
        }
    }, [selectedRampIndex, speedRamps, project, onProjectUpdate, recordAction]);

    /**
     * Handles removing a speed ramp segment.
     * Validates: Requirement 4.3 - User can adjust/remove speed ramp segments
     */
    const handleRemoveRamp = useCallback(() => {
        if (selectedRampIndex === null || selectedRampIndex >= speedRamps.length) return;
        
        // Get the ramp being removed for undo recording
        const rampToRemove = speedRamps[selectedRampIndex];
        
        const newRamps = speedRamps.filter((_, index) => index !== selectedRampIndex);
        setSpeedRamps(newRamps);
        setSelectedRampIndex(null);
        
        // Record action for undo - Requirement 5.4
        recordAction({ type: 'remove_speed_ramp', ramp: rampToRemove });
        
        // Persist to project settings
        if (onProjectUpdate) {
            const updatedProject: Project = {
                ...project,
                editSettings: {
                    ...project.editSettings,
                    speedRamps: newRamps,
                },
            };
            onProjectUpdate(updatedProject);
        }
    }, [selectedRampIndex, speedRamps, project, onProjectUpdate, recordAction]);

    /**
     * Checks if a point is inside the camera bubble.
     * Used for hit testing during drag interaction.
     * Validates: Requirement 4.1
     */
    const isPointInCameraBubble = useCallback(
        (clientX: number, clientY: number): boolean => {
            const canvas = canvasRef.current;
            if (!canvas || !project.cameraBlob) return false;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            // Convert client coordinates to canvas coordinates
            const canvasX = (clientX - rect.left) * scaleX;
            const canvasY = (clientY - rect.top) * scaleY;

            // Get camera bubble bounds
            const bubbleConfig = {
                position: localCameraBubblePosition,
                size: project.editSettings.cameraBubbleSize ?? DEFAULT_CAMERA_BUBBLE_CONFIG.size,
                shape: project.editSettings.cameraBubbleShape ?? DEFAULT_CAMERA_BUBBLE_CONFIG.shape,
                borderWidth: project.editSettings.cameraBubbleBorderWidth ?? DEFAULT_CAMERA_BUBBLE_CONFIG.borderWidth,
                borderColor: project.editSettings.cameraBubbleBorderColor ?? DEFAULT_CAMERA_BUBBLE_CONFIG.borderColor,
                shadowEnabled: true,
                backgroundBlur: project.editSettings.cameraBackgroundBlur ?? 0,
            };

            const bounds = calculateCameraBubbleBounds(bubbleConfig, {
                width: canvas.width,
                height: canvas.height,
            });

            // Check if point is inside bubble bounds
            const isInside =
                canvasX >= bounds.x &&
                canvasX <= bounds.x + bounds.width &&
                canvasY >= bounds.y &&
                canvasY <= bounds.y + bounds.height;

            return isInside;
        },
        [project.cameraBlob, project.editSettings, localCameraBubblePosition]
    );

    /**
     * Handles click on the preview canvas to set zoom center position.
     * When a keyframe is selected and user clicks on the canvas (not on camera bubble),
     * updates the keyframe's center position to the clicked location.
     * Validates: Phase 3 Requirement 1.8
     */
    const handleCanvasClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            // Don't update zoom center if we were dragging the camera bubble
            if (isDraggingCameraBubble) return;
            
            // Don't update if clicking on camera bubble
            if (project.cameraBlob && isPointInCameraBubble(e.clientX, e.clientY)) return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            // Convert client coordinates to normalized canvas coordinates (0-1 range)
            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;

            const normalizedX = Math.max(0, Math.min(1, canvasX / canvas.width));
            const normalizedY = Math.max(0, Math.min(1, canvasY / canvas.height));

            // Update zoom segment position if one is selected
            if (selectedZoomSegmentIndex !== null && zoomSegments[selectedZoomSegmentIndex]) {
                setZoomSegments(prev => {
                    const newSegments = [...prev];
                    newSegments[selectedZoomSegmentIndex] = {
                        ...newSegments[selectedZoomSegmentIndex],
                        position: { x: normalizedX, y: normalizedY },
                    };
                    return newSegments;
                });
                return;
            }

            // Update the selected keyframe's position if one is selected
            if (selectedMarkerId) {
                handleMarkerUpdate(selectedMarkerId, {
                    position: { x: normalizedX, y: normalizedY },
                });
            }
        },
        [isDraggingCameraBubble, selectedMarkerId, selectedZoomSegmentIndex, zoomSegments, project.cameraBlob, isPointInCameraBubble, handleMarkerUpdate]
    );

    /**
     * Handles mouse down on the preview canvas.
     * Starts camera bubble drag if clicking on the bubble.
     * Validates: Requirements 4.1, 4.8
     */
    const handleCanvasMouseDown = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!project.cameraBlob) return;

            if (isPointInCameraBubble(e.clientX, e.clientY)) {
                e.preventDefault();
                setIsDraggingCameraBubble(true);

                const canvas = canvasRef.current;
                if (!canvas) return;

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                // Calculate offset from bubble center to mouse position
                const canvasX = (e.clientX - rect.left) * scaleX;
                const canvasY = (e.clientY - rect.top) * scaleY;

                const normalizedX = canvasX / canvas.width;
                const normalizedY = canvasY / canvas.height;

                setCameraBubbleDragOffset({
                    x: normalizedX - localCameraBubblePosition.x,
                    y: normalizedY - localCameraBubblePosition.y,
                });
            }
        },
        [project.cameraBlob, isPointInCameraBubble, localCameraBubblePosition]
    );

    /**
     * Handles mouse move on the preview canvas.
     * Updates camera bubble position during drag.
     * Also tracks mouse position for zoom segment cursor following.
     * Validates: Requirements 4.1, 4.8
     */
    const handleCanvasMouseMove = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            // Calculate normalized position
            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;

            const normalizedX = canvasX / canvas.width;
            const normalizedY = canvasY / canvas.height;

            // Always update mouse position for zoom segment tracking
            // Clamp to valid range [0, 1]
            const newMousePos = {
                x: Math.max(0, Math.min(1, normalizedX)),
                y: Math.max(0, Math.min(1, normalizedY)),
            };
            mousePositionRef.current = newMousePos;

            // Check if we're in or near a zoom segment - if so, update state to trigger re-render
            const video = videoRef.current;
            if (video && zoomSegments.length > 0) {
                const timestampUs = video.currentTime * 1_000_000;
                const transitionDurationUs = 200_000;
                const isInOrNearZoomSegment = zoomSegments.some(seg => 
                    timestampUs >= seg.start - transitionDurationUs && 
                    timestampUs <= seg.end + transitionDurationUs
                );
                if (isInOrNearZoomSegment) {
                    // Update state to trigger re-render with new mouse position
                    setMousePosition(newMousePos);
                    console.log('[EditView] Mouse in zoom segment, pos:', newMousePos, 'timestamp:', timestampUs);
                }
            }

            // Handle camera bubble drag if active
            if (isDraggingCameraBubble) {
                // Apply offset and clamp to valid range
                const newX = Math.max(0, Math.min(1, normalizedX - cameraBubbleDragOffset.x));
                const newY = Math.max(0, Math.min(1, normalizedY - cameraBubbleDragOffset.y));

                // Update local position for real-time feedback
                setLocalCameraBubblePosition({ x: newX, y: newY });
            }
        },
        [isDraggingCameraBubble, cameraBubbleDragOffset, zoomSegments]
    );

    /**
     * Handles mouse up on the preview canvas.
     * Ends camera bubble drag and persists position to editSettings.
     * Validates: Requirements 4.1, 4.3, 4.8
     */
    const handleCanvasMouseUp = useCallback(() => {
        if (!isDraggingCameraBubble) return;

        setIsDraggingCameraBubble(false);

        // Persist the new position to project editSettings
        if (onProjectUpdate) {
            const updatedProject: Project = {
                ...project,
                editSettings: {
                    ...project.editSettings,
                    cameraBubblePosition: localCameraBubblePosition,
                },
            };
            onProjectUpdate(updatedProject);
        }
    }, [isDraggingCameraBubble, localCameraBubblePosition, project, onProjectUpdate]);

    /**
     * Handles mouse leave on the preview canvas.
     * Ends camera bubble drag if mouse leaves canvas area.
     * Validates: Requirement 4.8
     */
    const handleCanvasMouseLeave = useCallback(() => {
        if (isDraggingCameraBubble) {
            handleCanvasMouseUp();
        }
    }, [isDraggingCameraBubble, handleCanvasMouseUp]);

    const handleExport = useCallback(async () => {
        const video = videoRef.current;
        const camera = cameraRef.current;
        const audio = audioRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas) return;

        setIsExporting(true);
        setExportProgress(0);

        try {
            // Create export canvas
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = 1280;
            exportCanvas.height = 720;
            const ctx = exportCanvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            // Create compositor for rendering frames using user's edit settings
            // This ensures the export uses the same visual settings as the preview
            // Validates: Requirements 1.2, 2.3, 3.3, 4.1
            const compositorConfig = createConfigFromEditSettings(
                exportCanvas.width,
                exportCanvas.height,
                project.editSettings
            );
            const compositor = new CanvasCompositor(ctx, compositorConfig);

            // Get effect tracks and cursor track from analysis result
            const effectTracks = analysisResult?.effect_tracks?.effects ?? [];
            const cursorTrack = analysisResult?.cursor_track ?? [];

            // Set up MediaRecorder with canvas stream
            const canvasStream = exportCanvas.captureStream(30);

            // Add audio track if available
            if (audio && project.audioBlob) {
                // Create audio context to capture audio
                const audioContext = new AudioContext();
                const audioSource = audioContext.createMediaElementSource(audio);
                const destination = audioContext.createMediaStreamDestination();
                audioSource.connect(destination);
                audioSource.connect(audioContext.destination); // Also play through speakers

                // Add audio track to canvas stream
                destination.stream.getAudioTracks().forEach(track => {
                    canvasStream.addTrack(track);
                });
            }

            const chunks: Blob[] = [];
            const recorder = new MediaRecorder(canvasStream, {
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: 5000000,
            });

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            // Promise to wait for recording to finish
            const recordingDone = new Promise<Blob>((resolve) => {
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    resolve(blob);
                };
            });

            // Start recording
            recorder.start(100);

            // Generate frame timestamps for export with full time remapping support
            // Accounts for trim points, cuts, and speed ramps
            // Validates: Requirements 2.5, 3.5, 4.5, 4.8
            const fps = 30;
            const { sourceTimestamps, frameCount: totalFrames } = generateFrameTimestampsWithRemap(
                inPoint,
                outPoint,
                cuts,
                speedRamps,
                fps
            );

            // Process each frame sequentially
            // Validates: Requirements 1.1, 1.2, 2.1, 2.5, 3.1, 5.4
            for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                // Use source timestamp for seeking video (offset by inPoint)
                const sourceTimestampUs = sourceTimestamps[frameIndex];

                // Seek video to source timestamp
                const seekResult = await waitForVideoSeek(video, sourceTimestampUs);
                if (!seekResult.success) {
                    console.warn(`[EditView] Seek failed for frame ${frameIndex}, using last frame`);
                }

                // Sync camera video if available
                if (camera && project.cameraBlob) {
                    camera.currentTime = sourceTimestampUs / 1_000_000;
                }

                // Get viewport by interpolating from zoom segments and keyframes
                // Zoom segments take precedence when active, otherwise fall back to keyframes
                // Zoom segments follow the cursor position for dynamic tracking
                const viewport: Viewport = interpolateViewportCombined(zoomSegments, zoomMarkers, sourceTimestampUs, cursorTrack);

                // Find active effects at this source timestamp
                // Validates: Requirement 2.1
                const activeEffects = findActiveEffects(effectTracks, sourceTimestampUs);

                // Render frame using compositor
                // Note: Cursor rendering disabled - using real cursor for zoom tracking instead
                // Validates: Requirements 1.2, 2.3, 4.1, 4.2, 4.3, 4.5
                compositor.renderFrame(
                    video,
                    {
                        timestamp_us: sourceTimestampUs,
                        viewport,
                        activeEffects,
                        cursorPosition: null,
                        cursorOpacity: 0,
                    },
                    camera && project.cameraBlob && camera.readyState >= 2 ? camera : undefined
                );

                // Update progress
                // Validates: Requirement 5.4
                const progress = ((frameIndex + 1) / totalFrames) * 100;
                setExportProgress(Math.min(progress, 100));
            }

            // Stop recording after all frames are processed
            recorder.stop();

            // Wait for recording to complete
            const exportedBlob = await recordingDone;

            // Download the file
            const url = URL.createObjectURL(exportedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project.name || 'screenmu-export'}.webm`;
            a.click();
            URL.revokeObjectURL(url);

            console.log('[EditView] Export complete, size:', exportedBlob.size);
        } catch (err) {
            console.error('[EditView] Export failed:', err);
            alert('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsExporting(false);
            setExportProgress(0);

            // Reset video state
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
        }
    }, [project, analysisResult, zoomMarkers, zoomSegments, inPoint, outPoint, cuts, speedRamps]);

    const formatTime = (us: number): string => {
        const totalSeconds = Math.floor(us / 1000000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((us % 1000000) / 10000);
        return `${minutes}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    };

    const selectedMarker = zoomMarkers.find((m) => m.id === selectedMarkerId);

    return (
        <div className="edit-view">
            {/* Video Preview Panel (Left) */}
            <div className="preview-panel">
                {isLoading ? (
                    <div className="loading">Loading engine...</div>
                ) : error ? (
                    <div className="error">{error}</div>
                ) : !isVideoReady ? (
                    <div className="loading">Loading video...</div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        width={1280}
                        height={720}
                        className="preview-canvas"
                        onClick={handleCanvasClick}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseLeave}
                        style={{ cursor: isDraggingCameraBubble ? 'grabbing' : ((selectedMarkerId || selectedZoomSegmentIndex !== null) ? 'crosshair' : 'default') }}
                    />
                )}
                {/* Hidden camera video element - used as source for compositor rendering */}
                {project.cameraBlob && (
                    <video
                        ref={cameraRef}
                        muted
                        playsInline
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                    />
                )}
                {/* Hidden video element for playback source */}
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
                {/* Hidden audio element for microphone playback */}
                {project.audioBlob && (
                    <audio
                        ref={audioRef}
                        style={{ display: 'none' }}
                    />
                )}
            </div>

            {/* Right Sidebar (Controls) */}
            <div className="edit-sidebar">
                {/* Export Button */}
                <div className="export-section">
                    <button 
                        className="btn-export" 
                        onClick={handleExport} 
                        disabled={isLoading || isExporting}
                    >
                        <span>{isExporting ? '⏳' : '📤'}</span>
                        {isExporting ? `Exporting ${Math.round(exportProgress)}%` : 'Export video'}
                    </button>
                    {isExporting && (
                        <div className="export-progress">
                            <div 
                                className="export-progress-bar" 
                                style={{ width: `${exportProgress}%` }}
                            />
                        </div>
                    )}
                    <button className="btn-timeline" onClick={onBack} disabled={isExporting}>
                        ← Back to Home
                    </button>
                </div>

                {/* Aspect Ratio */}
                <div className="settings-section">
                    <h3>Aspect Ratio</h3>
                    <select defaultValue="native">
                        <option value="native">Native</option>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16 (Vertical)</option>
                        <option value="1:1">1:1 (Square)</option>
                        <option value="4:3">4:3</option>
                    </select>
                </div>

                {/* Background */}
                <div className="settings-section">
                    <h3>Background</h3>
                    <label>Gradient</label>
                    <div className="gradient-grid">
                        {/* Preset gradients - dynamically rendered from GRADIENT_PRESETS */}
                        {GRADIENT_PRESETS.map((preset) => {
                            // Build CSS gradient string from preset colors
                            const colorStops = preset.colors
                                .map((color, index) => {
                                    const percent = (index / (preset.colors.length - 1)) * 100;
                                    return `${color} ${percent}%`;
                                })
                                .join(', ');
                            const gradientStyle = `linear-gradient(${preset.angle}deg, ${colorStops})`;
                            const isSelected = project.editSettings.backgroundGradient === preset.id;

                            return (
                                <div
                                    key={preset.id}
                                    className={`gradient-option${isSelected ? ' selected' : ''}`}
                                    style={{ background: gradientStyle }}
                                    onClick={() => handleGradientSelect(preset.id)}
                                    title={preset.name}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            handleGradientSelect(preset.id);
                                        }
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Image Blur */}
                <div className="settings-section">
                    <label>Image blur</label>
                    <input type="range" min="0" max="20" defaultValue="10" />
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>Moderate</div>
                </div>

                {/* Browser Frame */}
                <div className="settings-section">
                    <h3>Browser Frame</h3>
                    <div className="frame-options">
                        <div 
                            className={`frame-option${project.editSettings.deviceFrame === 'browser' ? ' selected' : ''}`}
                            onClick={() => handleDeviceFrameSelect('browser')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleDeviceFrameSelect('browser');
                                }
                            }}
                        >
                            Browser
                        </div>
                        <div 
                            className={`frame-option${project.editSettings.deviceFrame === 'macbook' ? ' selected' : ''}`}
                            onClick={() => handleDeviceFrameSelect('macbook')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleDeviceFrameSelect('macbook');
                                }
                            }}
                        >
                            MacBook
                        </div>
                        <div 
                            className={`frame-option${project.editSettings.deviceFrame === 'none' ? ' selected' : ''}`}
                            onClick={() => handleDeviceFrameSelect('none')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleDeviceFrameSelect('none');
                                }
                            }}
                        >
                            None
                        </div>
                    </div>
                    <div className="toggle-row">
                        <label>Draw shadow</label>
                        <label className="toggle-switch">
                            <input 
                                type="checkbox" 
                                checked={project.editSettings.screenShadowEnabled}
                                onChange={(e) => handleShadowToggle(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                    <div className="toggle-row">
                        <label>Draw border</label>
                        <label className="toggle-switch">
                            <input type="checkbox" />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Camera Bubble Settings - Requirements 4.2, 4.5 */}
                {project.cameraBlob && (
                    <div className="settings-section">
                        <h3>Camera Bubble</h3>
                        <label>
                            Size: {Math.round((project.editSettings.cameraBubbleSize ?? DEFAULT_CAMERA_BUBBLE_CONFIG.size) * 100)}%
                        </label>
                        <input
                            type="range"
                            min={MIN_CAMERA_BUBBLE_SIZE}
                            max={MAX_CAMERA_BUBBLE_SIZE}
                            step={0.01}
                            value={project.editSettings.cameraBubbleSize ?? DEFAULT_CAMERA_BUBBLE_CONFIG.size}
                            onChange={(e) => handleCameraBubbleSizeChange(parseFloat(e.target.value))}
                        />
                        {/* Shape selector - Requirement 4.5 */}
                        <label style={{ marginTop: '12px' }}>Shape</label>
                        <div className="frame-options">
                            <div
                                className={`frame-option${(project.editSettings.cameraBubbleShape ?? DEFAULT_CAMERA_BUBBLE_CONFIG.shape) === 'circle' ? ' selected' : ''}`}
                                onClick={() => handleCameraBubbleShapeChange('circle')}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        handleCameraBubbleShapeChange('circle');
                                    }
                                }}
                            >
                                Circle
                            </div>
                            <div
                                className={`frame-option${(project.editSettings.cameraBubbleShape ?? DEFAULT_CAMERA_BUBBLE_CONFIG.shape) === 'rounded-rect' ? ' selected' : ''}`}
                                onClick={() => handleCameraBubbleShapeChange('rounded-rect')}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        handleCameraBubbleShapeChange('rounded-rect');
                                    }
                                }}
                            >
                                Rounded Rect
                            </div>
                        </div>
                        {/* Background Blur slider - Requirements 5.3, 5.4 */}
                        <label style={{ marginTop: '12px' }}>
                            Background Blur: {(project.editSettings.cameraBackgroundBlur ?? 0) === 0 
                                ? 'Off' 
                                : `${project.editSettings.cameraBackgroundBlur ?? 0}px`}
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={MAX_BACKGROUND_BLUR}
                            step={1}
                            value={project.editSettings.cameraBackgroundBlur ?? 0}
                            onChange={(e) => handleCameraBackgroundBlurChange(parseFloat(e.target.value))}
                        />
                        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                            Drag the bubble in the preview to reposition
                        </div>
                    </div>
                )}

                {/* Trim Controls - Requirement 2.7 */}
                <div className="settings-section">
                    <h3>Trim</h3>
                    <div className="trim-info">
                        <div className="property-row">
                            <span className="property-label">In Point</span>
                            <span className="property-value">{formatTime(inPoint)}</span>
                        </div>
                        <div className="property-row">
                            <span className="property-label">Out Point</span>
                            <span className="property-value">{formatTime(outPoint)}</span>
                        </div>
                        <div className="property-row">
                            <span className="property-label">Duration</span>
                            <span className="property-value">{formatTime(outPoint - inPoint)}</span>
                        </div>
                    </div>
                    <button
                        className="btn-reset-trim"
                        onClick={handleTrimReset}
                        disabled={inPoint === 0 && outPoint === project.duration}
                    >
                        <span>↺</span>
                        Reset Trim
                    </button>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                        Drag the handles on the timeline to trim
                    </div>
                </div>

                {/* Cut Controls - Requirement 3.1 */}
                <div className="settings-section">
                    <h3>Cut Segments</h3>
                    <div className="cut-controls">
                        {cutInProgress === null ? (
                            <>
                                <button
                                    className="btn-cut-action"
                                    onClick={handleSetCutIn}
                                    disabled={!isVideoReady}
                                >
                                    <span>✂️</span>
                                    Mark Cut In
                                </button>
                                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                                    Position playhead and click to mark cut start
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="cut-in-progress">
                                    <div className="property-row">
                                        <span className="property-label">Cut In</span>
                                        <span className="property-value">{formatTime(cutInProgress)}</span>
                                    </div>
                                    <div className="property-row">
                                        <span className="property-label">Current</span>
                                        <span className="property-value">{formatTime(currentTime)}</span>
                                    </div>
                                </div>
                                <div className="cut-action-buttons">
                                    <button
                                        className="btn-cut-action btn-cut-out"
                                        onClick={handleSetCutOut}
                                        disabled={!isVideoReady}
                                    >
                                        <span>✂️</span>
                                        Mark Cut Out
                                    </button>
                                    <button
                                        className="btn-cut-action btn-cancel"
                                        onClick={handleCancelCut}
                                    >
                                        <span>✕</span>
                                        Cancel
                                    </button>
                                </div>
                                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                                    Position playhead and click to mark cut end
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* Cut segments list */}
                    {cuts.length > 0 && (
                        <div className="cuts-list">
                            <label style={{ marginTop: '12px', display: 'block' }}>
                                {cuts.length} cut segment{cuts.length !== 1 ? 's' : ''}
                            </label>
                            {cuts.map((cut, index) => (
                                <div
                                    key={`cut-item-${index}`}
                                    className={`cut-list-item ${selectedCutIndex === index ? 'selected' : ''}`}
                                    onClick={() => handleCutSelect(index)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            handleCutSelect(index);
                                        }
                                    }}
                                >
                                    <span className="cut-icon">✂️</span>
                                    <span className="cut-range">
                                        {formatTime(cut.start)} - {formatTime(cut.end)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Remove selected cut button */}
                    {selectedCutIndex !== null && (
                        <button
                            className="btn-remove-cut"
                            onClick={handleRemoveCut}
                        >
                            <span>🗑</span>
                            Remove Cut
                        </button>
                    )}
                </div>

                {/* Speed Ramp Controls - Requirements 4.1, 4.2, 4.3 */}
                <div className="settings-section">
                    <h3>Speed Ramps</h3>
                    <div className="speed-ramp-controls">
                        {rampInProgress === null ? (
                            <>
                                {/* Speed preset selector for new ramps */}
                                <label>Speed for new ramp</label>
                                <div className="speed-preset-buttons">
                                    <button
                                        className={`speed-preset-btn ${pendingRampSpeed === 0.25 ? 'selected' : ''}`}
                                        onClick={() => setPendingRampSpeed(0.25)}
                                        title="Slow motion (0.25x)"
                                    >
                                        🐢 0.25x
                                    </button>
                                    <button
                                        className={`speed-preset-btn ${pendingRampSpeed === 0.5 ? 'selected' : ''}`}
                                        onClick={() => setPendingRampSpeed(0.5)}
                                        title="Half speed (0.5x)"
                                    >
                                        🐌 0.5x
                                    </button>
                                    <button
                                        className={`speed-preset-btn ${pendingRampSpeed === 2 ? 'selected' : ''}`}
                                        onClick={() => setPendingRampSpeed(2)}
                                        title="Double speed (2x)"
                                    >
                                        ⚡ 2x
                                    </button>
                                    <button
                                        className={`speed-preset-btn ${pendingRampSpeed === 4 ? 'selected' : ''}`}
                                        onClick={() => setPendingRampSpeed(4)}
                                        title="Fast forward (4x)"
                                    >
                                        🚀 4x
                                    </button>
                                </div>
                                
                                {/* Custom speed slider */}
                                <label style={{ marginTop: '12px' }}>
                                    Custom speed: <strong>{pendingRampSpeed.toFixed(2)}x</strong>
                                </label>
                                <div className="slider-with-labels">
                                    <span className="slider-label-min">0.25x</span>
                                    <input
                                        type="range"
                                        min={0.25}
                                        max={4}
                                        step={0.05}
                                        value={pendingRampSpeed}
                                        onChange={(e) => setPendingRampSpeed(parseFloat(e.target.value))}
                                        className="speed-slider"
                                    />
                                    <span className="slider-label-max">4x</span>
                                </div>
                                
                                <button
                                    className="btn-ramp-action"
                                    onClick={handleSetRampStart}
                                    disabled={!isVideoReady}
                                >
                                    <span>⏱️</span>
                                    Mark Speed Ramp Start
                                </button>
                                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                                    Position playhead and click to mark speed ramp start
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="ramp-in-progress">
                                    <div className="property-row">
                                        <span className="property-label">Ramp Start</span>
                                        <span className="property-value">{formatTime(rampInProgress.start)}</span>
                                    </div>
                                    <div className="property-row">
                                        <span className="property-label">Current</span>
                                        <span className="property-value">{formatTime(currentTime)}</span>
                                    </div>
                                    <div className="property-row">
                                        <span className="property-label">Speed</span>
                                        <span className="property-value">{rampInProgress.speed.toFixed(2)}x</span>
                                    </div>
                                </div>
                                <div className="ramp-action-buttons">
                                    <button
                                        className="btn-ramp-action btn-ramp-end"
                                        onClick={handleSetRampEnd}
                                        disabled={!isVideoReady}
                                    >
                                        <span>⏱️</span>
                                        Mark End
                                    </button>
                                    <button
                                        className="btn-ramp-action btn-cancel"
                                        onClick={handleCancelRamp}
                                    >
                                        <span>✕</span>
                                        Cancel
                                    </button>
                                </div>
                                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                                    Position playhead and click to mark speed ramp end
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* Speed ramps list */}
                    {speedRamps.length > 0 && (
                        <div className="ramps-list">
                            <label style={{ marginTop: '12px', display: 'block' }}>
                                {speedRamps.length} speed ramp{speedRamps.length !== 1 ? 's' : ''}
                            </label>
                            {speedRamps.map((ramp, index) => (
                                <div
                                    key={`ramp-item-${index}`}
                                    className={`ramp-list-item ${selectedRampIndex === index ? 'selected' : ''} ${ramp.speed < 1 ? 'slow' : 'fast'}`}
                                    onClick={() => handleRampSelect(index)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            handleRampSelect(index);
                                        }
                                    }}
                                >
                                    <span className="ramp-icon">{ramp.speed < 1 ? '🐢' : '⚡'}</span>
                                    <span className="ramp-speed">{ramp.speed.toFixed(2)}x</span>
                                    <span className="ramp-range">
                                        {formatTime(ramp.range.start)} - {formatTime(ramp.range.end)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Selected speed ramp editor */}
                    {selectedRampIndex !== null && speedRamps[selectedRampIndex] && (
                        <div className="selected-ramp-editor">
                            <label style={{ marginTop: '12px' }}>
                                Adjust speed: <strong>{speedRamps[selectedRampIndex].speed.toFixed(2)}x</strong>
                            </label>
                            <div className="slider-with-labels">
                                <span className="slider-label-min">0.25x</span>
                                <input
                                    type="range"
                                    min={0.25}
                                    max={4}
                                    step={0.05}
                                    value={speedRamps[selectedRampIndex].speed}
                                    onChange={(e) => handleRampSpeedChange(parseFloat(e.target.value))}
                                    className="speed-slider"
                                />
                                <span className="slider-label-max">4x</span>
                            </div>
                            <button
                                className="btn-remove-ramp"
                                onClick={handleRemoveRamp}
                            >
                                <span>🗑</span>
                                Remove Speed Ramp
                            </button>
                        </div>
                    )}
                </div>

                {/* Keyframe Editor Panel - Requirements 1.3, 1.4, 1.6 */}
                {selectedMarker && (
                    <div className="settings-section keyframe-editor">
                        <h3>Selected Keyframe</h3>
                        
                        {/* Keyframe Properties Display - Requirement 1.3 */}
                        <div className="keyframe-properties">
                            <div className="property-row">
                                <span className="property-label">Timestamp</span>
                                <span className="property-value">{formatTime(selectedMarker.timestamp)}</span>
                            </div>
                            <div className="property-row">
                                <span className="property-label">Zoom Level</span>
                                <span className="property-value">{selectedMarker.zoomLevel.toFixed(1)}x</span>
                            </div>
                            <div className="property-row">
                                <span className="property-label">Position</span>
                                <span className="property-value">
                                    X: {(selectedMarker.position.x * 100).toFixed(0)}%, Y: {(selectedMarker.position.y * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                        
                        {/* Zoom Level Slider - Requirement 1.4 */}
                        <div className="keyframe-control">
                            <label>
                                Zoom Level: <strong>{selectedMarker.zoomLevel.toFixed(1)}x</strong>
                            </label>
                            <div className="slider-with-labels">
                                <span className="slider-label-min">1x</span>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={selectedMarker.zoomLevel}
                                    onChange={(e) =>
                                        handleMarkerUpdate(selectedMarker.id, {
                                            zoomLevel: parseFloat(e.target.value),
                                        })
                                    }
                                    className="zoom-slider"
                                />
                                <span className="slider-label-max">3x</span>
                            </div>
                        </div>
                        
                        {/* Delete Button - Requirement 1.6 */}
                        <button
                            className="btn-delete-keyframe"
                            onClick={() => handleDeleteMarker(selectedMarker.id)}
                        >
                            <span>🗑</span>
                            Delete Keyframe
                        </button>
                    </div>
                )}

                {/* Zoom Segment Editor Panel */}
                {selectedZoomSegmentIndex !== null && zoomSegments[selectedZoomSegmentIndex] && (
                    <div className="settings-section zoom-segment-editor">
                        <h3>Zoom Segment</h3>
                        
                        <div className="keyframe-properties">
                            <div className="property-row">
                                <span className="property-label">Start</span>
                                <span className="property-value">{formatTime(zoomSegments[selectedZoomSegmentIndex].start)}</span>
                            </div>
                            <div className="property-row">
                                <span className="property-label">End</span>
                                <span className="property-value">{formatTime(zoomSegments[selectedZoomSegmentIndex].end)}</span>
                            </div>
                            <div className="property-row">
                                <span className="property-label">Duration</span>
                                <span className="property-value">
                                    {((zoomSegments[selectedZoomSegmentIndex].end - zoomSegments[selectedZoomSegmentIndex].start) / 1000000).toFixed(1)}s
                                </span>
                            </div>
                            <div className="property-row">
                                <span className="property-label">Position</span>
                                <span className="property-value">
                                    X: {(zoomSegments[selectedZoomSegmentIndex].position.x * 100).toFixed(0)}%, Y: {(zoomSegments[selectedZoomSegmentIndex].position.y * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                        
                        <div className="keyframe-control">
                            <label>
                                Zoom Level: <strong>{zoomSegments[selectedZoomSegmentIndex].zoomLevel.toFixed(1)}x</strong>
                            </label>
                            <div className="slider-with-labels">
                                <span className="slider-label-min">1x</span>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoomSegments[selectedZoomSegmentIndex].zoomLevel}
                                    onChange={(e) => handleZoomSegmentLevelChange(parseFloat(e.target.value))}
                                    className="zoom-slider"
                                />
                                <span className="slider-label-max">3x</span>
                            </div>
                        </div>
                        
                        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                            Click on the preview to set zoom center position
                        </div>
                        
                        <button
                            className="btn-delete-keyframe"
                            onClick={() => handleDeleteZoomSegment(selectedZoomSegmentIndex)}
                        >
                            <span>🗑</span>
                            Delete Zoom Segment
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Timeline Panel */}
            <div className="timeline-panel">
                <div className="playback-controls">
                    <button
                        className="btn-play"
                        onClick={handlePlayPause}
                        disabled={!isVideoReady}
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                    <div className="time-display">
                        {formatTime(currentTime)} / {formatTime(project.duration)}
                    </div>
                    <div className="timeline-actions">
                        <button 
                            className={`btn-timeline btn-add ${zoomSegmentInProgress !== null ? 'active' : ''}`}
                            onClick={handleAddZoomSegment}
                        >
                            {zoomSegmentInProgress !== null ? '✓ Set End' : '+ Add Zoom'}
                        </button>
                        {/* Undo/Redo Buttons - Requirement 5.6: Buttons SHALL be disabled when no actions are available */}
                        <button 
                            className="btn-timeline btn-undo"
                            onClick={handleUndo}
                            disabled={!undoManager.canUndo()}
                            title="Undo (Ctrl+Z)"
                        >
                            ↶ Undo
                        </button>
                        <button 
                            className="btn-timeline btn-redo"
                            onClick={handleRedo}
                            disabled={!undoManager.canRedo()}
                            title="Redo (Ctrl+Shift+Z)"
                        >
                            ↷ Redo
                        </button>
                    </div>
                </div>

                <Timeline
                    duration={project.duration}
                    currentTime={currentTime}
                    markers={zoomMarkers}
                    selectedMarkerId={selectedMarkerId}
                    onSeek={handleSeek}
                    onMarkerSelect={handleMarkerSelect}
                    onMarkerTimestampChange={handleMarkerTimestampChange}
                    inPoint={inPoint}
                    outPoint={outPoint}
                    onInPointChange={handleInPointChange}
                    onOutPointChange={handleOutPointChange}
                    cuts={cuts}
                    selectedCutIndex={selectedCutIndex}
                    onCutSelect={handleCutSelect}
                    speedRamps={speedRamps}
                    selectedRampIndex={selectedRampIndex}
                    onRampSelect={handleRampSelect}
                    zoomSegments={zoomSegments}
                    selectedZoomSegmentIndex={selectedZoomSegmentIndex}
                    onZoomSegmentSelect={handleZoomSegmentSelect}
                    onZoomSegmentUpdate={handleZoomSegmentUpdate}
                />
            </div>
        </div>
    );
}

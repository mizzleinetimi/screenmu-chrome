// EditView - Timeline editor for adjusting zoom keyframes
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useWasmEngine } from '../hooks/useWasmEngine';
import { Timeline } from '../components/Timeline';
import type { Project, ZoomMarker, AnalysisResult, EngineConfig } from '../types';
import '../styles/EditView.css';

interface EditViewProps {
    project: Project;
    onExport: (project: Project) => void;
    onBack: () => void;
}

export function EditView({ project, onExport, onBack }: EditViewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const cameraRef = useRef<HTMLVideoElement>(null);
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
    useEffect(() => {
        const video = videoRef.current;
        const camera = cameraRef.current;
        if (!video || !camera || !project.cameraBlob) return;

        const syncCamera = () => {
            if (Math.abs(camera.currentTime - video.currentTime) > 0.1) {
                camera.currentTime = video.currentTime;
            }
        };

        const handlePlay = () => {
            camera.play().catch(() => { });
        };

        const handlePause = () => {
            camera.pause();
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('seeked', syncCamera);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('seeked', syncCamera);
        };
    }, [project.cameraBlob]);

    // Process signals when engine is ready
    useEffect(() => {
        if (!isLoading && !error && !analysisResult) {
            const result = processSignals(project.signals);
            if (result) {
                setAnalysisResult(result);

                // Convert camera keyframes to zoom markers for UI
                const markers: ZoomMarker[] = result.camera_keyframes.map((kf, i) => ({
                    id: `kf-${i}`,
                    timestamp: kf.timestamp,
                    position: kf.viewport.center,
                    zoomLevel: kf.viewport.zoom,
                }));
                setZoomMarkers(markers);
            }
        }
    }, [isLoading, error, analysisResult, processSignals, project.signals]);

    // Render frame to canvas
    const renderFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // For now, just draw the full video frame
        // WASM viewport calls cause performance issues at 60fps
        // TODO: Implement proper caching or move to worker
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }, []);

    // Animation loop for playback
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isVideoReady) return;

        const animate = () => {
            setCurrentTime(video.currentTime * 1000000);
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
        };
    }, [isPlaying, isVideoReady, renderFrame]);

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
            setZoomMarkers((prev) =>
                prev.map((m) => (m.id === markerId ? { ...m, ...updates } : m))
            );
        },
        []
    );

    const handleAddMarker = useCallback(() => {
        const newMarker: ZoomMarker = {
            id: `kf-${Date.now()}`,
            timestamp: currentTime,
            position: { x: 0.5, y: 0.5 },
            zoomLevel: 1.5,
        };
        setZoomMarkers((prev) =>
            [...prev, newMarker].sort((a, b) => a.timestamp - b.timestamp)
        );
        setSelectedMarkerId(newMarker.id);
    }, [currentTime]);

    const handleDeleteMarker = useCallback(
        (markerId: string) => {
            setZoomMarkers((prev) => prev.filter((m) => m.id !== markerId));
            if (selectedMarkerId === markerId) {
                setSelectedMarkerId(null);
            }
        },
        [selectedMarkerId]
    );

    const handleExport = useCallback(() => {
        // Update project with current markers
        const updatedProject: Project = {
            ...project,
            analysisResult: analysisResult ?? undefined,
        };
        onExport(updatedProject);
    }, [project, analysisResult, onExport]);

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
                    />
                )}
                {/* Camera PiP */}
                {project.cameraBlob && (
                    <video
                        ref={cameraRef}
                        muted
                        playsInline
                        className="camera-pip"
                        style={{ display: isVideoReady ? 'block' : 'none' }}
                    />
                )}
                {/* Hidden video element for playback source */}
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
            </div>

            {/* Right Sidebar (Controls) */}
            <div className="edit-sidebar">
                {/* Export Button */}
                <div className="export-section">
                    <button className="btn-export" onClick={handleExport} disabled={isLoading}>
                        <span>📤</span>
                        Export video
                    </button>
                    <button className="btn-timeline" onClick={onBack}>
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
                        {/* Preset gradients */}
                        <div
                            className="gradient-option selected"
                            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                        />
                        <div
                            className="gradient-option"
                            style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
                        />
                        <div
                            className="gradient-option"
                            style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}
                        />
                        <div
                            className="gradient-option"
                            style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}
                        />
                        <div
                            className="gradient-option"
                            style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}
                        />
                        <div
                            className="gradient-option"
                            style={{ background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' }}
                        />
                        <div
                            className="gradient-option"
                            style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}
                        />
                        <div
                            className="gradient-option"
                            style={{ background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' }}
                        />
                        <div
                            className="gradient-option"
                            style={{ background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' }}
                        />
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
                        <div className="frame-option selected">Default</div>
                        <div className="frame-option">Minimal</div>
                        <div className="frame-option">Hidden</div>
                    </div>
                    <div className="toggle-row">
                        <label>Draw shadow</label>
                        <label className="toggle-switch">
                            <input type="checkbox" defaultChecked />
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

                {/* Advanced Settings (Existing Marker Editor) */}
                {selectedMarker && (
                    <div className="settings-section">
                        <h3>Zoom Keyframe Settings</h3>
                        <label>Zoom Level: {selectedMarker.zoomLevel.toFixed(1)}x</label>
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
                        />
                        <button
                            className="btn-timeline"
                            onClick={() => handleDeleteMarker(selectedMarker.id)}
                            style={{ marginTop: '12px', color: '#ef4444' }}
                        >
                            🗑 Delete Marker
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
                        <button className="btn-timeline btn-add" onClick={handleAddMarker}>
                            + Add a segment
                        </button>
                        <button className="btn-timeline">↶</button>
                        <button className="btn-timeline">↷</button>
                    </div>
                </div>

                <Timeline
                    duration={project.duration}
                    currentTime={currentTime}
                    markers={zoomMarkers}
                    selectedMarkerId={selectedMarkerId}
                    onSeek={handleSeek}
                    onMarkerSelect={handleMarkerSelect}
                />
            </div>
        </div>
    );
}

// Timeline component with scrubber and keyframe markers
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { useRef, useCallback, useState } from 'react';
import type { ZoomMarker, SpeedRamp, ZoomSegment } from '../types';
import { TrimHandles } from './TrimHandles';
import { CutSegments, type TimeRange } from './CutSegments';
import { SpeedRamps } from './SpeedRamps';
import { ZoomSegments } from './ZoomSegments';
import '../styles/Timeline.css';

interface TimelineProps {
    duration: number; // microseconds
    currentTime: number; // microseconds
    markers: ZoomMarker[];
    selectedMarkerId: string | null;
    onSeek: (timeUs: number) => void;
    onMarkerSelect: (markerId: string) => void;
    onMarkerTimestampChange?: (markerId: string, newTimestamp: number) => void;
    // Trim functionality props - Requirements 2.2, 2.3
    inPoint?: number; // microseconds
    outPoint?: number; // microseconds
    onInPointChange?: (time: number) => void;
    onOutPointChange?: (time: number) => void;
    // Cut segments props - Requirement 3.2
    cuts?: TimeRange[];
    selectedCutIndex?: number | null;
    onCutSelect?: (index: number) => void;
    // Speed ramp props - Requirement 4.4
    speedRamps?: SpeedRamp[];
    selectedRampIndex?: number | null;
    onRampSelect?: (index: number) => void;
    // Zoom segments props
    zoomSegments?: ZoomSegment[];
    selectedZoomSegmentIndex?: number | null;
    onZoomSegmentSelect?: (index: number) => void;
    onZoomSegmentUpdate?: (index: number, segment: ZoomSegment) => void;
}

// Drag state for keyframe markers
interface DragState {
    markerId: string;
    startX: number;
    startTimestamp: number;
}

export function Timeline({
    duration,
    currentTime,
    markers,
    selectedMarkerId,
    onSeek,
    onMarkerSelect,
    onMarkerTimestampChange,
    inPoint,
    outPoint,
    onInPointChange,
    onOutPointChange,
    cuts,
    selectedCutIndex,
    onCutSelect,
    speedRamps,
    selectedRampIndex,
    onRampSelect,
    zoomSegments,
    selectedZoomSegmentIndex,
    onZoomSegmentSelect,
    onZoomSegmentUpdate,
}: TimelineProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [draggedTimestamp, setDraggedTimestamp] = useState<number | null>(null);

    const handleTrackClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            // Don't seek if we just finished dragging
            if (dragState) return;

            const track = trackRef.current;
            if (!track) return;

            const rect = track.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = x / rect.width;
            const timeUs = Math.max(0, Math.min(duration, ratio * duration));
            onSeek(timeUs);
        },
        [duration, onSeek, dragState]
    );

    // Handle marker click for selection (Requirement 1.2)
    const handleMarkerClick = useCallback(
        (e: React.MouseEvent, markerId: string) => {
            e.stopPropagation();
            // Only select if not dragging
            if (!dragState) {
                onMarkerSelect(markerId);
            }
        },
        [onMarkerSelect, dragState]
    );

    // Handle marker drag start (Requirement 1.5)
    const handleMarkerMouseDown = useCallback(
        (e: React.MouseEvent, marker: ZoomMarker) => {
            e.preventDefault();
            e.stopPropagation();

            // Select the marker when starting to drag
            onMarkerSelect(marker.id);

            setDragState({
                markerId: marker.id,
                startX: e.clientX,
                startTimestamp: marker.timestamp,
            });
            setDraggedTimestamp(marker.timestamp);
        },
        [onMarkerSelect]
    );

    // Handle mouse move during drag
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!dragState || !trackRef.current) return;

            const track = trackRef.current;
            const rect = track.getBoundingClientRect();
            const deltaX = e.clientX - dragState.startX;
            const deltaRatio = deltaX / rect.width;
            const deltaTime = deltaRatio * duration;

            // Calculate new timestamp, clamped to valid range
            const newTimestamp = Math.max(
                0,
                Math.min(duration, dragState.startTimestamp + deltaTime)
            );

            setDraggedTimestamp(newTimestamp);
        },
        [dragState, duration]
    );

    // Handle mouse up to end drag
    const handleMouseUp = useCallback(() => {
        if (dragState && draggedTimestamp !== null && onMarkerTimestampChange) {
            // Only update if timestamp actually changed
            if (draggedTimestamp !== dragState.startTimestamp) {
                onMarkerTimestampChange(dragState.markerId, draggedTimestamp);
            }
        }
        setDragState(null);
        setDraggedTimestamp(null);
    }, [dragState, draggedTimestamp, onMarkerTimestampChange]);

    // Handle mouse leave to cancel drag if mouse leaves track
    const handleMouseLeave = useCallback(() => {
        if (dragState) {
            // Commit the change if we have one
            if (draggedTimestamp !== null && onMarkerTimestampChange) {
                if (draggedTimestamp !== dragState.startTimestamp) {
                    onMarkerTimestampChange(dragState.markerId, draggedTimestamp);
                }
            }
            setDragState(null);
            setDraggedTimestamp(null);
        }
    }, [dragState, draggedTimestamp, onMarkerTimestampChange]);

    const formatTime = (us: number): string => {
        const totalSeconds = Math.floor(us / 1000000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Get the display timestamp for a marker (use dragged position if being dragged)
    const getMarkerTimestamp = (marker: ZoomMarker): number => {
        if (dragState && dragState.markerId === marker.id && draggedTimestamp !== null) {
            return draggedTimestamp;
        }
        return marker.timestamp;
    };

    return (
        <div className="timeline">
            <div className="timeline-times">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            <div
                className={`timeline-track ${dragState ? 'dragging' : ''}`}
                ref={trackRef}
                onClick={handleTrackClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                {/* Trim Handles - Requirements 2.1, 2.2, 2.3, 2.4 */}
                {onInPointChange && onOutPointChange && (
                    <TrimHandles
                        duration={duration}
                        inPoint={inPoint ?? 0}
                        outPoint={outPoint ?? duration}
                        onInPointChange={onInPointChange}
                        onOutPointChange={onOutPointChange}
                    />
                )}

                {/* Cut Segments - Requirement 3.2 */}
                {cuts && cuts.length > 0 && (
                    <CutSegments
                        duration={duration}
                        cuts={cuts}
                        selectedCutIndex={selectedCutIndex ?? null}
                        onCutSelect={onCutSelect}
                    />
                )}

                {/* Speed Ramps - Requirement 4.4 */}
                {speedRamps && speedRamps.length > 0 && (
                    <SpeedRamps
                        duration={duration}
                        speedRamps={speedRamps}
                        selectedRampIndex={selectedRampIndex ?? null}
                        onRampSelect={onRampSelect}
                    />
                )}

                {/* Zoom Segments - draggable zoom regions */}
                {zoomSegments && zoomSegments.length > 0 && (
                    <ZoomSegments
                        duration={duration}
                        zoomSegments={zoomSegments}
                        selectedSegmentIndex={selectedZoomSegmentIndex ?? null}
                        onSegmentSelect={onZoomSegmentSelect}
                        onSegmentUpdate={onZoomSegmentUpdate}
                    />
                )}

                {/* Markers */}
                {markers.map((marker) => {
                    const displayTimestamp = getMarkerTimestamp(marker);
                    const position = duration > 0 ? (displayTimestamp / duration) * 100 : 0;
                    const isSelected = marker.id === selectedMarkerId;
                    const isDragging = dragState?.markerId === marker.id;
                    return (
                        <div
                            key={marker.id}
                            className={`timeline-marker ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                            style={{ left: `${position}%` }}
                            onClick={(e) => handleMarkerClick(e, marker.id)}
                            onMouseDown={(e) => handleMarkerMouseDown(e, marker)}
                            title={`${marker.zoomLevel.toFixed(1)}x zoom at ${formatTime(displayTimestamp)}`}
                        >
                            <div className="marker-dot" />
                            <div className="marker-label">{marker.zoomLevel.toFixed(1)}x</div>
                        </div>
                    );
                })}

                {/* Playhead */}
                <div className="timeline-playhead" style={{ left: `${playheadPosition}%` }} />
            </div>
        </div>
    );
}

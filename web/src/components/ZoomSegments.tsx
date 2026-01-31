// ZoomSegments component - displays draggable zoom segments on the timeline
// A zoom segment represents a time range where the video zooms in, then returns to normal
// LLM Disclosure: This file was generated with AI assistance.

import { useRef, useCallback, useState } from 'react';
import type { ZoomSegment } from '../types';
import '../styles/ZoomSegments.css';

interface ZoomSegmentsProps {
    /** Total duration in microseconds */
    duration: number;
    /** Array of zoom segments */
    zoomSegments: ZoomSegment[];
    /** Currently selected segment index */
    selectedSegmentIndex: number | null;
    /** Callback when a segment is selected */
    onSegmentSelect?: (index: number) => void;
    /** Callback when a segment is updated (dragged/resized) */
    onSegmentUpdate?: (index: number, segment: ZoomSegment) => void;
}

type DragType = 'move' | 'resize-start' | 'resize-end';

interface DragState {
    segmentIndex: number;
    dragType: DragType;
    startX: number;
    originalStart: number;
    originalEnd: number;
}

export function ZoomSegments({
    duration,
    zoomSegments,
    selectedSegmentIndex,
    onSegmentSelect,
    onSegmentUpdate,
}: ZoomSegmentsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [previewSegment, setPreviewSegment] = useState<{ start: number; end: number } | null>(null);

    // Convert timestamp to percentage position
    const toPercent = (timeUs: number): number => {
        return duration > 0 ? (timeUs / duration) * 100 : 0;
    };

    // Convert pixel delta to time delta
    const pixelToTime = useCallback((pixelDelta: number): number => {
        if (!containerRef.current || duration <= 0) return 0;
        const rect = containerRef.current.getBoundingClientRect();
        return (pixelDelta / rect.width) * duration;
    }, [duration]);

    // Handle segment click for selection
    const handleSegmentClick = useCallback((e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        if (!dragState && onSegmentSelect) {
            onSegmentSelect(index);
        }
    }, [dragState, onSegmentSelect]);

    // Handle drag start for moving or resizing
    const handleMouseDown = useCallback((
        e: React.MouseEvent,
        index: number,
        dragType: DragType
    ) => {
        e.preventDefault();
        e.stopPropagation();

        const segment = zoomSegments[index];
        setDragState({
            segmentIndex: index,
            dragType,
            startX: e.clientX,
            originalStart: segment.start,
            originalEnd: segment.end,
        });
        setPreviewSegment({ start: segment.start, end: segment.end });

        if (onSegmentSelect) {
            onSegmentSelect(index);
        }
    }, [zoomSegments, onSegmentSelect]);

    // Handle mouse move during drag
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragState) return;

        const deltaX = e.clientX - dragState.startX;
        const deltaTime = pixelToTime(deltaX);

        let newStart = dragState.originalStart;
        let newEnd = dragState.originalEnd;
        const minDuration = 100000; // Minimum 100ms segment

        switch (dragState.dragType) {
            case 'move':
                // Move the entire segment
                newStart = Math.max(0, dragState.originalStart + deltaTime);
                newEnd = dragState.originalEnd + deltaTime;
                // Clamp to duration
                if (newEnd > duration) {
                    const overflow = newEnd - duration;
                    newStart -= overflow;
                    newEnd = duration;
                }
                newStart = Math.max(0, newStart);
                break;

            case 'resize-start':
                // Resize from the start handle
                newStart = Math.max(0, Math.min(dragState.originalEnd - minDuration, dragState.originalStart + deltaTime));
                break;

            case 'resize-end':
                // Resize from the end handle
                newEnd = Math.min(duration, Math.max(dragState.originalStart + minDuration, dragState.originalEnd + deltaTime));
                break;
        }

        setPreviewSegment({ start: newStart, end: newEnd });
    }, [dragState, pixelToTime, duration]);

    // Handle mouse up to commit the drag
    const handleMouseUp = useCallback(() => {
        if (dragState && previewSegment && onSegmentUpdate) {
            const segment = zoomSegments[dragState.segmentIndex];
            // Only update if something changed
            if (previewSegment.start !== segment.start || previewSegment.end !== segment.end) {
                onSegmentUpdate(dragState.segmentIndex, {
                    ...segment,
                    start: previewSegment.start,
                    end: previewSegment.end,
                });
            }
        }
        setDragState(null);
        setPreviewSegment(null);
    }, [dragState, previewSegment, zoomSegments, onSegmentUpdate]);

    // Handle mouse leave
    const handleMouseLeave = useCallback(() => {
        if (dragState) {
            handleMouseUp();
        }
    }, [dragState, handleMouseUp]);

    // Get display values for a segment (use preview if dragging)
    const getSegmentDisplay = (segment: ZoomSegment, index: number) => {
        if (dragState && dragState.segmentIndex === index && previewSegment) {
            return previewSegment;
        }
        return { start: segment.start, end: segment.end };
    };

    return (
        <div
            ref={containerRef}
            className={`zoom-segments-container ${dragState ? 'dragging' : ''}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >
            {zoomSegments.map((segment, index) => {
                const display = getSegmentDisplay(segment, index);
                const leftPercent = toPercent(display.start);
                const widthPercent = toPercent(display.end - display.start);
                const isSelected = selectedSegmentIndex === index;
                const isDragging = dragState?.segmentIndex === index;

                return (
                    <div
                        key={segment.id}
                        className={`zoom-segment ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                        style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                        }}
                        onClick={(e) => handleSegmentClick(e, index)}
                    >
                        {/* Left resize handle */}
                        <div
                            className="zoom-segment-handle zoom-segment-handle-left"
                            onMouseDown={(e) => handleMouseDown(e, index, 'resize-start')}
                        />

                        {/* Segment body (draggable) */}
                        <div
                            className="zoom-segment-body"
                            onMouseDown={(e) => handleMouseDown(e, index, 'move')}
                        >
                            <span className="zoom-segment-label">{segment.zoomLevel.toFixed(1)}x</span>
                        </div>

                        {/* Right resize handle */}
                        <div
                            className="zoom-segment-handle zoom-segment-handle-right"
                            onMouseDown={(e) => handleMouseDown(e, index, 'resize-end')}
                        />
                    </div>
                );
            })}
        </div>
    );
}

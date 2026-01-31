// TrimHandles component for timeline trim functionality
// Validates: Requirements 2.1, 2.4 - Display trim handles and visual indication of trimmed regions
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { useRef, useCallback, useState } from 'react';
import '../styles/TrimHandles.css';

/**
 * Props for the TrimHandles component.
 * Based on design.md TrimHandlesProps interface.
 */
interface TrimHandlesProps {
    /** Total video duration in microseconds */
    duration: number;
    /** In point (start of active region) in microseconds */
    inPoint: number;
    /** Out point (end of active region) in microseconds */
    outPoint: number;
    /** Callback when in point changes */
    onInPointChange: (time: number) => void;
    /** Callback when out point changes */
    onOutPointChange: (time: number) => void;
}

/** Drag state for trim handles */
interface DragState {
    handle: 'in' | 'out';
    startX: number;
    startTime: number;
}

/**
 * TrimHandles component renders draggable handles at the start and end of the timeline
 * for trimming video content. Trimmed regions are shown with a dimmed overlay.
 * 
 * Validates: Requirement 2.1 - THE timeline SHALL display trim handles at the start and end of the video
 * Validates: Requirement 2.4 - WHEN trim handles are adjusted, THE timeline SHALL visually indicate the trimmed regions
 */
export function TrimHandles({
    duration,
    inPoint,
    outPoint,
    onInPointChange,
    onOutPointChange,
}: TrimHandlesProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [draggedTime, setDraggedTime] = useState<number | null>(null);

    // Calculate positions as percentages
    const getDisplayInPoint = (): number => {
        if (dragState?.handle === 'in' && draggedTime !== null) {
            return draggedTime;
        }
        return inPoint;
    };

    const getDisplayOutPoint = (): number => {
        if (dragState?.handle === 'out' && draggedTime !== null) {
            return draggedTime;
        }
        return outPoint;
    };

    const displayInPoint = getDisplayInPoint();
    const displayOutPoint = getDisplayOutPoint();

    const inPointPercent = duration > 0 ? (displayInPoint / duration) * 100 : 0;
    const outPointPercent = duration > 0 ? (displayOutPoint / duration) * 100 : 100;

    /**
     * Handle mouse down on trim handle to start dragging.
     * Validates: Requirement 2.2, 2.3 - User can drag handles to set in/out points
     */
    const handleMouseDown = useCallback(
        (e: React.MouseEvent, handle: 'in' | 'out') => {
            e.preventDefault();
            e.stopPropagation();

            const startTime = handle === 'in' ? inPoint : outPoint;
            setDragState({
                handle,
                startX: e.clientX,
                startTime,
            });
            setDraggedTime(startTime);
        },
        [inPoint, outPoint]
    );

    /**
     * Handle mouse move during drag to update handle position.
     */
    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!dragState || !trackRef.current) return;

            const track = trackRef.current;
            const rect = track.getBoundingClientRect();
            const deltaX = e.clientX - dragState.startX;
            const deltaRatio = deltaX / rect.width;
            const deltaTime = deltaRatio * duration;

            let newTime = dragState.startTime + deltaTime;

            // Clamp to valid range based on which handle is being dragged
            if (dragState.handle === 'in') {
                // In point must be >= 0 and < out point (with minimum gap)
                const minGap = duration * 0.01; // 1% minimum gap
                newTime = Math.max(0, Math.min(outPoint - minGap, newTime));
            } else {
                // Out point must be > in point and <= duration
                const minGap = duration * 0.01; // 1% minimum gap
                newTime = Math.max(inPoint + minGap, Math.min(duration, newTime));
            }

            setDraggedTime(newTime);
        },
        [dragState, duration, inPoint, outPoint]
    );

    /**
     * Handle mouse up to end drag and commit the change.
     */
    const handleMouseUp = useCallback(() => {
        if (dragState && draggedTime !== null) {
            if (dragState.handle === 'in') {
                onInPointChange(draggedTime);
            } else {
                onOutPointChange(draggedTime);
            }
        }
        setDragState(null);
        setDraggedTime(null);
    }, [dragState, draggedTime, onInPointChange, onOutPointChange]);

    /**
     * Handle mouse leave to commit drag if mouse leaves track area.
     */
    const handleMouseLeave = useCallback(() => {
        if (dragState) {
            handleMouseUp();
        }
    }, [dragState, handleMouseUp]);

    return (
        <div
            className={`trim-handles ${dragState ? 'dragging' : ''}`}
            ref={trackRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >
            {/* Trimmed region overlay - before in point (dimmed) */}
            {/* Validates: Requirement 2.4 - Visual indication of trimmed regions */}
            {inPointPercent > 0 && (
                <div
                    className="trim-region trim-region-start"
                    style={{ width: `${inPointPercent}%` }}
                />
            )}

            {/* Trimmed region overlay - after out point (dimmed) */}
            {/* Validates: Requirement 2.4 - Visual indication of trimmed regions */}
            {outPointPercent < 100 && (
                <div
                    className="trim-region trim-region-end"
                    style={{ 
                        left: `${outPointPercent}%`,
                        width: `${100 - outPointPercent}%` 
                    }}
                />
            )}

            {/* In point handle (start trim) */}
            {/* Validates: Requirement 2.1 - Display trim handles at start */}
            <div
                className={`trim-handle trim-handle-in ${dragState?.handle === 'in' ? 'dragging' : ''}`}
                style={{ left: `${inPointPercent}%` }}
                onMouseDown={(e) => handleMouseDown(e, 'in')}
                title="Drag to set start point"
            >
                <div className="trim-handle-bar" />
                <div className="trim-handle-grip">
                    <span className="grip-line" />
                    <span className="grip-line" />
                    <span className="grip-line" />
                </div>
            </div>

            {/* Out point handle (end trim) */}
            {/* Validates: Requirement 2.1 - Display trim handles at end */}
            <div
                className={`trim-handle trim-handle-out ${dragState?.handle === 'out' ? 'dragging' : ''}`}
                style={{ left: `${outPointPercent}%` }}
                onMouseDown={(e) => handleMouseDown(e, 'out')}
                title="Drag to set end point"
            >
                <div className="trim-handle-bar" />
                <div className="trim-handle-grip">
                    <span className="grip-line" />
                    <span className="grip-line" />
                    <span className="grip-line" />
                </div>
            </div>

            {/* Active region indicator (between in and out points) */}
            <div
                className="trim-active-region"
                style={{
                    left: `${inPointPercent}%`,
                    width: `${outPointPercent - inPointPercent}%`,
                }}
            />
        </div>
    );
}

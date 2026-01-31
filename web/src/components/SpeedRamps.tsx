// SpeedRamps component for timeline speed ramp visualization
// Validates: Requirement 4.4 - THE timeline SHALL visually indicate speed ramp segments with their speed value
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import type { SpeedRamp } from '../types';
import '../styles/SpeedRamps.css';

// Re-export SpeedRamp for backward compatibility
export type { SpeedRamp } from '../types';

/**
 * Props for the SpeedRamps component.
 */
interface SpeedRampsProps {
    /** Total video duration in microseconds */
    duration: number;
    /** Array of speed ramp segments */
    speedRamps: SpeedRamp[];
    /** Currently selected speed ramp index (null if none selected) */
    selectedRampIndex: number | null;
    /** Callback when a speed ramp segment is clicked/selected */
    onRampSelect?: (index: number) => void;
}

/**
 * Determines the size class for a speed ramp segment based on its width percentage.
 * Used to adjust visual styling for very small segments.
 */
function getRampSizeClass(widthPercent: number): string {
    if (widthPercent < 2) {
        return 'tiny';
    }
    if (widthPercent < 5) {
        return 'small';
    }
    return '';
}

/**
 * Formats the speed value for display.
 * Shows values like "0.25x", "0.5x", "2x", "4x"
 */
function formatSpeed(speed: number): string {
    // For whole numbers, don't show decimal
    if (Number.isInteger(speed)) {
        return `${speed}x`;
    }
    // For common fractions, show appropriate precision
    if (speed === 0.25 || speed === 0.5 || speed === 0.75) {
        return `${speed}x`;
    }
    // For other values, show one decimal place
    return `${speed.toFixed(1)}x`;
}

/**
 * Determines if the speed is slow-mo (< 1x) or fast-forward (> 1x).
 */
function getSpeedType(speed: number): 'slow' | 'fast' | 'normal' {
    if (speed < 1) {
        return 'slow';
    }
    if (speed > 1) {
        return 'fast';
    }
    return 'normal';
}

/**
 * SpeedRamps component renders visual representation of speed ramp regions on the timeline.
 * Speed ramp segments are displayed with a blue/purple gradient pattern to distinguish them
 * from cut segments (red striped) and trimmed regions (solid dark overlay).
 * 
 * Validates: Requirement 4.4 - THE timeline SHALL visually indicate speed ramp segments 
 * with their speed value
 */
export function SpeedRamps({
    duration,
    speedRamps,
    selectedRampIndex,
    onRampSelect,
}: SpeedRampsProps) {
    // Don't render if no duration or no speed ramps
    if (duration <= 0 || speedRamps.length === 0) {
        return null;
    }

    /**
     * Handle click on a speed ramp segment to select it.
     */
    const handleRampClick = (e: React.MouseEvent, index: number): void => {
        e.stopPropagation();
        if (onRampSelect) {
            onRampSelect(index);
        }
    };

    return (
        <div className="speed-ramps">
            {speedRamps.map((ramp, index) => {
                // Calculate position and width as percentages
                const startPercent = (ramp.range.start / duration) * 100;
                const endPercent = (ramp.range.end / duration) * 100;
                const widthPercent = endPercent - startPercent;

                // Skip invalid ramps
                if (widthPercent <= 0) {
                    return null;
                }

                const isSelected = selectedRampIndex === index;
                const sizeClass = getRampSizeClass(widthPercent);
                const speedType = getSpeedType(ramp.speed);
                const speedLabel = formatSpeed(ramp.speed);

                return (
                    <div
                        key={`ramp-${index}-${ramp.range.start}-${ramp.range.end}`}
                        className={`speed-ramp ${isSelected ? 'selected' : ''} ${sizeClass} ${speedType}`}
                        style={{
                            left: `${startPercent}%`,
                            width: `${widthPercent}%`,
                        }}
                        onClick={(e) => handleRampClick(e, index)}
                        title={`Speed ramp: ${speedLabel} (${formatTime(ramp.range.start)} - ${formatTime(ramp.range.end)})`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Speed ramp ${speedLabel} from ${formatTime(ramp.range.start)} to ${formatTime(ramp.range.end)}${isSelected ? ', selected' : ''}`}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (onRampSelect) {
                                    onRampSelect(index);
                                }
                            }
                        }}
                    >
                        {/* Visual indicator icon */}
                        <div className="speed-ramp-icon" aria-hidden="true">
                            {speedType === 'slow' ? '🐢' : speedType === 'fast' ? '⚡' : '▶'}
                        </div>
                        {/* Label showing speed value (e.g., "2x", "0.5x") */}
                        <div className="speed-ramp-label" aria-hidden="true">
                            {speedLabel}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Format microseconds to MM:SS display format.
 */
function formatTime(us: number): string {
    const totalSeconds = Math.floor(us / 1000000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

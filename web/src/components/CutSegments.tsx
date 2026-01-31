// CutSegments component for timeline cut segment visualization
// Validates: Requirement 3.2 - THE timeline SHALL visually indicate cut segments with a different color or pattern
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import type { TimeRange } from '../types';
import '../styles/CutSegments.css';

// Re-export TimeRange for backward compatibility
export type { TimeRange } from '../types';

/**
 * Props for the CutSegments component.
 */
interface CutSegmentsProps {
    /** Total video duration in microseconds */
    duration: number;
    /** Array of cut segments (removed ranges) */
    cuts: TimeRange[];
    /** Currently selected cut segment index (null if none selected) */
    selectedCutIndex: number | null;
    /** Callback when a cut segment is clicked/selected */
    onCutSelect?: (index: number) => void;
}

/**
 * Determines the size class for a cut segment based on its width percentage.
 * Used to adjust visual styling for very small segments.
 */
function getCutSizeClass(widthPercent: number): string {
    if (widthPercent < 2) {
        return 'tiny';
    }
    if (widthPercent < 5) {
        return 'small';
    }
    return '';
}

/**
 * CutSegments component renders visual representation of cut regions on the timeline.
 * Cut segments are displayed with a red striped pattern to distinguish them from
 * trimmed regions (which use a solid dark overlay).
 * 
 * Validates: Requirement 3.2 - THE timeline SHALL visually indicate cut segments 
 * with a different color or pattern
 */
export function CutSegments({
    duration,
    cuts,
    selectedCutIndex,
    onCutSelect,
}: CutSegmentsProps) {
    // Don't render if no duration or no cuts
    if (duration <= 0 || cuts.length === 0) {
        return null;
    }

    /**
     * Handle click on a cut segment to select it.
     */
    const handleCutClick = (e: React.MouseEvent, index: number): void => {
        e.stopPropagation();
        if (onCutSelect) {
            onCutSelect(index);
        }
    };

    return (
        <div className="cut-segments">
            {cuts.map((cut, index) => {
                // Calculate position and width as percentages
                const startPercent = (cut.start / duration) * 100;
                const endPercent = (cut.end / duration) * 100;
                const widthPercent = endPercent - startPercent;

                // Skip invalid cuts
                if (widthPercent <= 0) {
                    return null;
                }

                const isSelected = selectedCutIndex === index;
                const sizeClass = getCutSizeClass(widthPercent);

                return (
                    <div
                        key={`cut-${index}-${cut.start}-${cut.end}`}
                        className={`cut-segment ${isSelected ? 'selected' : ''} ${sizeClass}`}
                        style={{
                            left: `${startPercent}%`,
                            width: `${widthPercent}%`,
                        }}
                        onClick={(e) => handleCutClick(e, index)}
                        title={`Cut segment: ${formatTime(cut.start)} - ${formatTime(cut.end)}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Cut segment from ${formatTime(cut.start)} to ${formatTime(cut.end)}${isSelected ? ', selected' : ''}`}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (onCutSelect) {
                                    onCutSelect(index);
                                }
                            }
                        }}
                    >
                        {/* Visual indicator icon */}
                        <div className="cut-segment-icon" aria-hidden="true" />
                        {/* Label showing "CUT" */}
                        <div className="cut-segment-label" aria-hidden="true">
                            CUT
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

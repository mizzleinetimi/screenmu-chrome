// Timeline component with scrubber and keyframe markers
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { useRef, useCallback } from 'react';
import type { ZoomMarker } from '../types';
import '../styles/Timeline.css';

interface TimelineProps {
    duration: number; // microseconds
    currentTime: number; // microseconds
    markers: ZoomMarker[];
    selectedMarkerId: string | null;
    onSeek: (timeUs: number) => void;
    onMarkerSelect: (markerId: string) => void;
}

export function Timeline({
    duration,
    currentTime,
    markers,
    selectedMarkerId,
    onSeek,
    onMarkerSelect,
}: TimelineProps) {
    const trackRef = useRef<HTMLDivElement>(null);

    const handleTrackClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const track = trackRef.current;
            if (!track) return;

            const rect = track.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = x / rect.width;
            const timeUs = Math.max(0, Math.min(duration, ratio * duration));
            onSeek(timeUs);
        },
        [duration, onSeek]
    );

    const formatTime = (us: number): string => {
        const totalSeconds = Math.floor(us / 1000000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="timeline">
            <div className="timeline-times">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            <div className="timeline-track" ref={trackRef} onClick={handleTrackClick}>
                {/* Markers */}
                {markers.map((marker) => {
                    const position = (marker.timestamp / duration) * 100;
                    const isSelected = marker.id === selectedMarkerId;
                    return (
                        <div
                            key={marker.id}
                            className={`timeline-marker ${isSelected ? 'selected' : ''}`}
                            style={{ left: `${position}%` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onMarkerSelect(marker.id);
                            }}
                            title={`${marker.zoomLevel.toFixed(1)}x zoom at ${formatTime(marker.timestamp)}`}
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

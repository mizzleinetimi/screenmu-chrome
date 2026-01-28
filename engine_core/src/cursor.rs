// Cursor tracking with confidence.
// Tab Mode: real mouse + click targets. Desktop Mode: cursor-from-video detection.
// See steering.md: Auto-Zoom Strategy Rules

use crate::types::*;

/// Cursor tracker that processes input signals and generates cursor track with confidence.
pub struct CursorTracker {
    _capture_mode: CaptureMode,
    last_position: Option<NormalizedCoord>,
    last_timestamp: Option<Timestamp>,
}

impl CursorTracker {
    pub fn new(capture_mode: CaptureMode) -> Self {
        CursorTracker {
            _capture_mode: capture_mode,
            last_position: None,
            last_timestamp: None,
        }
    }

    /// Process a batch of signals and return cursor track points.
    pub fn process(&mut self, signals: &SignalBatch) -> Vec<CursorTrackPoint> {
        let mut track = Vec::with_capacity(signals.events.len());

        for event in &signals.events {
            if let Some(point) = self.process_event(event) {
                self.last_position = Some(point.position);
                self.last_timestamp = Some(point.timestamp);
                track.push(point);
            }
        }

        track
    }

    fn process_event(&self, event: &InputEvent) -> Option<CursorTrackPoint> {
        match &event.event_type {
            EventType::MouseMove { position } => Some(CursorTrackPoint {
                timestamp: event.timestamp,
                position: *position,
                state: CursorState::Visible,
                confidence: 100,
                reason: InferenceReason::DirectInput,
            }),

            EventType::MouseClick { position, .. } => Some(CursorTrackPoint {
                timestamp: event.timestamp,
                position: *position,
                state: CursorState::Visible,
                confidence: 100,
                reason: InferenceReason::DirectInput,
            }),

            EventType::FocusChange { bounds } => {
                // Use center of focused element as cursor proxy.
                Some(CursorTrackPoint {
                    timestamp: event.timestamp,
                    position: bounds.center(),
                    state: CursorState::Inferred,
                    confidence: 80,
                    reason: InferenceReason::UiChange,
                })
            }

            EventType::FrameCaptured { .. } => {
                // Desktop mode: would run cursor detection here.
                // For now, use last known position or center.
                let position = self.last_position.unwrap_or_else(NormalizedCoord::center);
                Some(CursorTrackPoint {
                    timestamp: event.timestamp,
                    position,
                    state: CursorState::Inferred,
                    confidence: 50,
                    reason: InferenceReason::SaliencyFallback,
                })
            }

            EventType::Scroll { .. } => None, // Scroll doesn't produce cursor points
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tab_mode_direct_input() {
        let mut tracker = CursorTracker::new(CaptureMode::Tab);
        let signals = SignalBatch {
            events: vec![InputEvent {
                timestamp: Timestamp::from_micros(1000),
                event_type: EventType::MouseMove {
                    position: NormalizedCoord::new(0.3, 0.7),
                },
            }],
        };

        let track = tracker.process(&signals);
        assert_eq!(track.len(), 1);
        assert_eq!(track[0].confidence, 100);
        assert_eq!(track[0].state, CursorState::Visible);
    }

    #[test]
    fn focus_change_inferred() {
        let mut tracker = CursorTracker::new(CaptureMode::Tab);
        let signals = SignalBatch {
            events: vec![InputEvent {
                timestamp: Timestamp::from_micros(1000),
                event_type: EventType::FocusChange {
                    bounds: NormalizedRect::new(0.2, 0.2, 0.4, 0.2),
                },
            }],
        };

        let track = tracker.process(&signals);
        assert_eq!(track.len(), 1);
        assert_eq!(track[0].state, CursorState::Inferred);
        // Center of bounds: x=0.2+0.2=0.4, y=0.2+0.1=0.3
        assert!((track[0].position.x - 0.4).abs() < 0.01);
    }
}

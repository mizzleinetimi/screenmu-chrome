// Focus region detection.
// Tab Mode: focused element bounds. Desktop Mode: UI-change detection, motion saliency.
// See steering.md: Auto-Zoom Strategy Rules

use crate::types::*;

/// Analyzes signals to detect focus regions (areas of interest).
pub struct FocusAnalyzer {
    active_regions: Vec<FocusRegion>,
}

impl FocusAnalyzer {
    pub fn new() -> Self {
        FocusAnalyzer {
            active_regions: Vec::new(),
        }
    }

    /// Analyze signals and cursor track to detect focus regions.
    pub fn analyze(
        &mut self,
        signals: &SignalBatch,
        cursor_track: &[CursorTrackPoint],
    ) -> Vec<FocusRegion> {
        let mut regions = Vec::new();

        // Process focus change events directly.
        for event in &signals.events {
            if let EventType::FocusChange { bounds } = &event.event_type {
                regions.push(FocusRegion {
                    timestamp: event.timestamp,
                    bounds: *bounds,
                    importance: 1.0,
                });
            }
        }

        // Generate focus regions from cursor click positions.
        for point in cursor_track {
            if point.confidence >= 80 {
                // High confidence cursor positions become focus regions.
                let region = self.cursor_to_focus_region(point);
                regions.push(region);
            }
        }

        self.active_regions = regions.clone();
        regions
    }

    fn cursor_to_focus_region(&self, point: &CursorTrackPoint) -> FocusRegion {
        // Create a focus region around the cursor position.
        // Size is based on a typical focus area (e.g., button, input field).
        let focus_size = 0.15; // 15% of screen

        FocusRegion {
            timestamp: point.timestamp,
            bounds: NormalizedRect::new(
                (point.position.x - focus_size / 2.0).max(0.0),
                (point.position.y - focus_size / 2.0).max(0.0),
                focus_size.min(1.0 - point.position.x + focus_size / 2.0),
                focus_size.min(1.0 - point.position.y + focus_size / 2.0),
            ),
            importance: point.confidence as f32 / 100.0,
        }
    }
}

impl Default for FocusAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn focus_change_creates_region() {
        let mut analyzer = FocusAnalyzer::new();
        let signals = SignalBatch {
            events: vec![InputEvent {
                timestamp: Timestamp::from_micros(1000),
                event_type: EventType::FocusChange {
                    bounds: NormalizedRect::new(0.1, 0.1, 0.3, 0.1),
                },
            }],
        };

        let regions = analyzer.analyze(&signals, &[]);
        assert_eq!(regions.len(), 1);
        assert_eq!(regions[0].importance, 1.0);
    }

    #[test]
    fn high_confidence_cursor_creates_region() {
        let mut analyzer = FocusAnalyzer::new();
        let cursor_track = vec![CursorTrackPoint {
            timestamp: Timestamp::from_micros(1000),
            position: NormalizedCoord::new(0.5, 0.5),
            state: CursorState::Visible,
            confidence: 100,
            reason: InferenceReason::DirectInput,
        }];

        let regions = analyzer.analyze(&SignalBatch { events: vec![] }, &cursor_track);
        assert_eq!(regions.len(), 1);
    }
}

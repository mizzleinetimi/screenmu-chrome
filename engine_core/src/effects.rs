// Effect tracks: click rings, cursor highlights, safe margins.
// See steering.md: Rust Rules (Engine)

use crate::types::*;

/// Generates visual effect tracks from input signals and cursor data.
pub struct EffectGenerator {
    settings: EffectSettings,
}

impl EffectGenerator {
    pub fn new(settings: EffectSettings) -> Self {
        EffectGenerator { settings }
    }

    /// Generate effect tracks from signals and cursor track.
    pub fn generate(
        &self,
        signals: &SignalBatch,
        cursor_track: &[CursorTrackPoint],
    ) -> EffectTrack {
        let mut effects = Vec::new();

        // Generate click ring effects.
        if self.settings.click_rings {
            for event in &signals.events {
                if let EventType::MouseClick { position, .. } = &event.event_type {
                    effects.push(Effect {
                        timestamp: event.timestamp,
                        duration_us: 300_000, // 300ms
                        effect_type: EffectType::ClickRing,
                        position: *position,
                    });
                }
            }
        }

        // Generate cursor highlight effects.
        if self.settings.cursor_highlight {
            for point in cursor_track {
                // Add highlight on high-confidence positions.
                if point.confidence >= 80 {
                    effects.push(Effect {
                        timestamp: point.timestamp,
                        duration_us: 100_000, // 100ms per frame
                        effect_type: EffectType::CursorHighlight,
                        position: point.position,
                    });
                }
            }
        }

        EffectTrack { effects }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn click_generates_ring_effect() {
        let generator = EffectGenerator::new(EffectSettings {
            click_rings: true,
            cursor_highlight: false,
        });

        let signals = SignalBatch {
            events: vec![InputEvent {
                timestamp: Timestamp::from_micros(1000),
                event_type: EventType::MouseClick {
                    position: NormalizedCoord::new(0.5, 0.5),
                    button: 0,
                },
            }],
        };

        let track = generator.generate(&signals, &[]);
        assert_eq!(track.effects.len(), 1);
        assert!(matches!(
            track.effects[0].effect_type,
            EffectType::ClickRing
        ));
    }

    #[test]
    fn disabled_effects_not_generated() {
        let generator = EffectGenerator::new(EffectSettings {
            click_rings: false,
            cursor_highlight: false,
        });

        let signals = SignalBatch {
            events: vec![InputEvent {
                timestamp: Timestamp::from_micros(1000),
                event_type: EventType::MouseClick {
                    position: NormalizedCoord::new(0.5, 0.5),
                    button: 0,
                },
            }],
        };

        let track = generator.generate(&signals, &[]);
        assert!(track.effects.is_empty());
    }
}

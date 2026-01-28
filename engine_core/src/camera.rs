// Camera keyframe generation with zoom/pan, smoothing, and stability constraints.
// Rule: A stable, slightly-wrong zoom feels better than a jittery "correct" zoom.
// See steering.md: Auto-Zoom Strategy Rules

use crate::types::*;

/// Camera engine: generates keyframes for zoom/pan based on cursor and focus data.
pub struct CameraEngine {
    settings: CameraSettings,
    keyframes: Vec<CameraKeyframe>,
}

impl CameraEngine {
    pub fn new(settings: CameraSettings) -> Self {
        CameraEngine {
            settings,
            keyframes: Vec::new(),
        }
    }

    /// Generate camera keyframes from cursor track and focus regions.
    pub fn generate_keyframes(
        &mut self,
        cursor_track: &[CursorTrackPoint],
        focus_regions: &[FocusRegion],
    ) -> Vec<CameraKeyframe> {
        let mut keyframes = Vec::new();

        // Start with a full-screen view.
        if !cursor_track.is_empty() || !focus_regions.is_empty() {
            let first_ts = cursor_track
                .first()
                .map(|p| p.timestamp)
                .or_else(|| focus_regions.first().map(|r| r.timestamp))
                .unwrap_or_else(|| Timestamp::from_micros(0));

            keyframes.push(CameraKeyframe {
                timestamp: first_ts,
                viewport: Viewport::default(),
                easing: EasingType::EaseOut,
            });
        }

        // Process cursor track to generate zoom keyframes.
        let mut last_keyframe_ts = Timestamp::from_micros(0);

        for point in cursor_track {
            // Apply min hold time constraint.
            let time_since_last = point.timestamp.as_micros() - last_keyframe_ts.as_micros();
            if time_since_last < self.settings.min_hold_time_us {
                continue;
            }

            // Check if cursor moved outside dead zone.
            if let Some(last_kf) = keyframes.last() {
                if self.is_within_dead_zone(&last_kf.viewport.center, &point.position) {
                    continue;
                }
            }

            // Only zoom on high-confidence points.
            if point.confidence < 70 {
                continue;
            }

            let viewport = self.calculate_viewport(point);
            keyframes.push(CameraKeyframe {
                timestamp: point.timestamp,
                viewport,
                easing: EasingType::EaseInOut,
            });

            last_keyframe_ts = point.timestamp;
        }

        // Supplement with focus region keyframes.
        for region in focus_regions {
            if region.importance >= 0.8 {
                let center = region.bounds.center();
                let zoom = self.calculate_zoom_for_bounds(&region.bounds);

                keyframes.push(CameraKeyframe {
                    timestamp: region.timestamp,
                    viewport: Viewport { center, zoom },
                    easing: EasingType::EaseOut,
                });
            }
        }

        // Sort by timestamp.
        keyframes.sort_by_key(|kf| kf.timestamp);

        // Apply smoothing pass.
        let smoothed = self.apply_smoothing(&keyframes);

        self.keyframes = smoothed.clone();
        smoothed
    }

    /// Get viewport at a specific timestamp (interpolated).
    pub fn get_viewport_at(&self, timestamp: Timestamp) -> Viewport {
        if self.keyframes.is_empty() {
            return Viewport::default();
        }

        // Find surrounding keyframes.
        let mut prev_kf = &self.keyframes[0];
        let mut next_kf = &self.keyframes[0];

        for (i, kf) in self.keyframes.iter().enumerate() {
            if kf.timestamp <= timestamp {
                prev_kf = kf;
                next_kf = self.keyframes.get(i + 1).unwrap_or(kf);
            }
        }

        // If past the last keyframe, return the last viewport.
        if timestamp >= next_kf.timestamp {
            return next_kf.viewport.clone();
        }

        // Interpolate between keyframes.
        let duration = next_kf.timestamp.as_micros() - prev_kf.timestamp.as_micros();
        if duration == 0 {
            return prev_kf.viewport.clone();
        }

        let progress =
            (timestamp.as_micros() - prev_kf.timestamp.as_micros()) as f32 / duration as f32;
        let eased_progress = self.apply_easing(progress, next_kf.easing);

        Viewport {
            center: NormalizedCoord::new(
                lerp(
                    prev_kf.viewport.center.x,
                    next_kf.viewport.center.x,
                    eased_progress,
                ),
                lerp(
                    prev_kf.viewport.center.y,
                    next_kf.viewport.center.y,
                    eased_progress,
                ),
            ),
            zoom: lerp(prev_kf.viewport.zoom, next_kf.viewport.zoom, eased_progress),
        }
    }

    fn is_within_dead_zone(&self, center: &NormalizedCoord, target: &NormalizedCoord) -> bool {
        let dx = center.x - target.x;
        let dy = center.y - target.y;
        let distance = (dx * dx + dy * dy).sqrt();
        distance < self.settings.dead_zone
    }

    fn calculate_viewport(&self, point: &CursorTrackPoint) -> Viewport {
        let zoom = match point.state {
            CursorState::Visible => self.settings.zoom_strength,
            CursorState::Inferred => self.settings.zoom_strength * 0.8,
            CursorState::Hidden => 1.0,
        };

        Viewport {
            center: point.position,
            zoom,
        }
    }

    fn calculate_zoom_for_bounds(&self, bounds: &NormalizedRect) -> f32 {
        // Zoom to fit bounds with some padding.
        let max_dim = bounds.width.max(bounds.height);
        if max_dim > 0.0 {
            (1.0 / max_dim).min(self.settings.zoom_strength)
        } else {
            1.0
        }
    }

    fn apply_smoothing(&self, keyframes: &[CameraKeyframe]) -> Vec<CameraKeyframe> {
        // Simple smoothing: enforce max pan speed.
        let mut smoothed = keyframes.to_vec();

        for i in 1..smoothed.len() {
            let prev_center = smoothed[i - 1].viewport.center;
            let curr_center = smoothed[i].viewport.center;

            let dx = curr_center.x - prev_center.x;
            let dy = curr_center.y - prev_center.y;
            let distance = (dx * dx + dy * dy).sqrt();

            let duration_secs = (smoothed[i].timestamp.as_micros()
                - smoothed[i - 1].timestamp.as_micros()) as f32
                / 1_000_000.0;

            if duration_secs > 0.0 {
                let speed = distance / duration_secs;
                if speed > self.settings.max_pan_speed {
                    // Clamp the movement.
                    let scale = self.settings.max_pan_speed / speed;
                    smoothed[i].viewport.center = NormalizedCoord::new(
                        prev_center.x + dx * scale,
                        prev_center.y + dy * scale,
                    );
                }
            }
        }

        smoothed
    }

    fn apply_easing(&self, t: f32, easing: EasingType) -> f32 {
        match easing {
            EasingType::Linear => t,
            EasingType::EaseOut => 1.0 - (1.0 - t).powi(3),
            EasingType::EaseInOut => {
                if t < 0.5 {
                    4.0 * t * t * t
                } else {
                    1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
                }
            }
            EasingType::Spring => {
                // Simple spring approximation.
                let c4 = (2.0 * std::f32::consts::PI) / 3.0;
                if t == 0.0 {
                    0.0
                } else if t == 1.0 {
                    1.0
                } else {
                    2.0_f32.powf(-10.0 * t) * ((t * 10.0 - 0.75) * c4).sin() + 1.0
                }
            }
        }
    }
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_initial_keyframe() {
        let mut engine = CameraEngine::new(CameraSettings::default());
        let cursor_track = vec![CursorTrackPoint {
            timestamp: Timestamp::from_micros(1000),
            position: NormalizedCoord::new(0.5, 0.5),
            state: CursorState::Visible,
            confidence: 100,
            reason: InferenceReason::DirectInput,
        }];

        let keyframes = engine.generate_keyframes(&cursor_track, &[]);
        assert!(!keyframes.is_empty());
    }

    #[test]
    fn easing_bounds() {
        let engine = CameraEngine::new(CameraSettings::default());
        for easing in [
            EasingType::Linear,
            EasingType::EaseOut,
            EasingType::EaseInOut,
            EasingType::Spring,
        ] {
            let start = engine.apply_easing(0.0, easing);
            let end = engine.apply_easing(1.0, easing);
            assert!(start >= -0.1 && start <= 0.1, "Easing start should be ~0");
            assert!(end >= 0.9 && end <= 1.1, "Easing end should be ~1");
        }
    }

    #[test]
    fn respects_min_hold_time() {
        let settings = CameraSettings {
            min_hold_time_us: 500_000, // 500ms
            ..Default::default()
        };
        let mut engine = CameraEngine::new(settings);

        let cursor_track = vec![
            CursorTrackPoint {
                timestamp: Timestamp::from_micros(0),
                position: NormalizedCoord::new(0.2, 0.2),
                state: CursorState::Visible,
                confidence: 100,
                reason: InferenceReason::DirectInput,
            },
            CursorTrackPoint {
                timestamp: Timestamp::from_micros(100_000), // 100ms later, should be skipped
                position: NormalizedCoord::new(0.8, 0.8),
                state: CursorState::Visible,
                confidence: 100,
                reason: InferenceReason::DirectInput,
            },
        ];

        let keyframes = engine.generate_keyframes(&cursor_track, &[]);
        // Should have initial keyframe but not the second one (too soon).
        assert!(keyframes.len() <= 2);
    }
}

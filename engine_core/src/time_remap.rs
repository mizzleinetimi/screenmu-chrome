// Time remapping calculations for cuts and speed ramps.
// Maps export timestamps to source timestamps, accounting for removed segments and speed changes.
// See design.md: TimeRemapper (Rust)

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::types::Timestamp;

/// A time range in microseconds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: Timestamp,
    pub end: Timestamp,
}

impl TimeRange {
    pub fn new(start: Timestamp, end: Timestamp) -> Self {
        TimeRange { start, end }
    }

    /// Duration of this range in microseconds.
    pub fn duration(&self) -> u64 {
        self.end.as_micros().saturating_sub(self.start.as_micros())
    }

    /// Check if a timestamp falls within this range (inclusive start, exclusive end).
    pub fn contains(&self, ts: Timestamp) -> bool {
        ts >= self.start && ts < self.end
    }
}

/// A speed ramp segment with a time range and speed multiplier.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SpeedRamp {
    pub range: TimeRange,
    pub speed: f32, // 0.25 to 4.0
}

impl SpeedRamp {
    pub fn new(range: TimeRange, speed: f32) -> Self {
        // Clamp speed to valid range
        let speed = speed.clamp(0.25, 4.0);
        SpeedRamp { range, speed }
    }

    /// Calculate the export duration for this speed ramp segment.
    /// Export duration = source duration / speed
    pub fn export_duration(&self) -> u64 {
        let source_duration = self.range.duration() as f64;
        (source_duration / self.speed as f64).round() as u64
    }
}

/// Time remapper that handles cuts and speed ramps.
/// Maps export timestamps to source timestamps for the export pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRemapper {
    cuts: Vec<TimeRange>,
    speed_ramps: Vec<SpeedRamp>,
    in_point: Timestamp,
    out_point: Timestamp,
}

impl TimeRemapper {
    /// Create a new TimeRemapper with the given configuration.
    pub fn new(
        cuts: Vec<TimeRange>,
        speed_ramps: Vec<SpeedRamp>,
        in_point: Timestamp,
        out_point: Timestamp,
    ) -> Self {
        let mut remapper = TimeRemapper {
            cuts,
            speed_ramps,
            in_point,
            out_point,
        };
        // Sort cuts by start time for efficient processing
        remapper.cuts.sort_by_key(|c| c.start);
        // Sort speed ramps by start time
        remapper.speed_ramps.sort_by(|a, b| a.range.start.cmp(&b.range.start));
        remapper
    }

    /// Create a TimeRemapper with no cuts or speed ramps.
    pub fn identity(in_point: Timestamp, out_point: Timestamp) -> Self {
        TimeRemapper {
            cuts: Vec::new(),
            speed_ramps: Vec::new(),
            in_point,
            out_point,
        }
    }

    /// Check if a source timestamp is within a cut region.
    pub fn is_cut(&self, source_time: Timestamp) -> bool {
        self.cuts.iter().any(|cut| cut.contains(source_time))
    }

    /// Get playback speed at a source timestamp.
    /// Returns 1.0 if no speed ramp is active at this timestamp.
    pub fn speed_at(&self, source_time: Timestamp) -> f32 {
        for ramp in &self.speed_ramps {
            if ramp.range.contains(source_time) {
                return ramp.speed;
            }
        }
        1.0
    }

    /// Calculate total export duration after cuts and speed changes.
    /// This accounts for:
    /// 1. Trim points (in_point to out_point)
    /// 2. Cut segments (removed from duration)
    /// 3. Speed ramps (duration adjusted by speed factor)
    pub fn export_duration(&self) -> Timestamp {
        let trimmed_duration = self.out_point.as_micros().saturating_sub(self.in_point.as_micros());
        
        if trimmed_duration == 0 {
            return Timestamp::from_micros(0);
        }

        // Calculate export duration by iterating through source time
        // and accounting for cuts and speed ramps
        let mut export_duration = 0u64;
        let mut source_time = self.in_point.as_micros();

        while source_time < self.out_point.as_micros() {
            let ts = Timestamp::from_micros(source_time);

            // Check if we're in a cut region
            if let Some(cut) = self.cuts.iter().find(|c| c.contains(ts)) {
                // Skip to end of cut
                source_time = cut.end.as_micros().min(self.out_point.as_micros());
                continue;
            }

            // Find the next boundary (cut start, speed ramp boundary, or out_point)
            let next_boundary = self.find_next_boundary(source_time);
            let segment_source_duration = next_boundary - source_time;

            // Get speed at this source time
            let speed = self.speed_at(ts);

            // Export duration for this segment = source duration / speed
            let segment_export_duration = (segment_source_duration as f64 / speed as f64).round() as u64;
            export_duration += segment_export_duration;

            source_time = next_boundary;
        }

        Timestamp::from_micros(export_duration)
    }

    /// Find the next boundary point from a given source time.
    /// Boundaries are: cut starts, speed ramp starts/ends, or out_point.
    fn find_next_boundary(&self, source_time: u64) -> u64 {
        let mut next = self.out_point.as_micros();

        // Check cut starts
        for cut in &self.cuts {
            let cut_start = cut.start.as_micros();
            if cut_start > source_time && cut_start < next {
                next = cut_start;
            }
        }

        // Check speed ramp boundaries
        for ramp in &self.speed_ramps {
            let ramp_start = ramp.range.start.as_micros();
            let ramp_end = ramp.range.end.as_micros();
            
            if ramp_start > source_time && ramp_start < next {
                next = ramp_start;
            }
            if ramp_end > source_time && ramp_end < next {
                next = ramp_end;
            }
        }

        next
    }

    /// Map export timestamp to source timestamp.
    /// This is the inverse of the export duration calculation.
    /// Given a timestamp in the exported video, returns the corresponding
    /// timestamp in the source video.
    ///
    /// The mapping accounts for:
    /// 1. Trim points (export starts at in_point)
    /// 2. Cut segments (skipped in export)
    /// 3. Speed ramps (time scaled by speed factor)
    pub fn to_source_time(&self, export_time: Timestamp) -> Timestamp {
        let export_time_us = export_time.as_micros();
        
        // Start at in_point and skip any cuts at the beginning
        let mut source_time = self.skip_cuts_forward(self.in_point).as_micros();
        
        if export_time_us == 0 {
            return Timestamp::from_micros(source_time);
        }

        let mut remaining_export_time = export_time_us;

        while remaining_export_time > 0 && source_time < self.out_point.as_micros() {
            let ts = Timestamp::from_micros(source_time);

            // Find the next boundary (cut start, speed ramp boundary, or out_point)
            let next_boundary = self.find_next_boundary(source_time);
            let segment_source_duration = next_boundary - source_time;

            // Get speed at this source time
            let speed = self.speed_at(ts);

            // Calculate export duration for this segment
            let segment_export_duration = (segment_source_duration as f64 / speed as f64).round() as u64;

            if remaining_export_time < segment_export_duration {
                // The target is within this segment
                // source_offset = export_offset * speed
                let source_offset = (remaining_export_time as f64 * speed as f64).round() as u64;
                source_time += source_offset;
                remaining_export_time = 0;
            } else {
                // Move past this segment
                remaining_export_time -= segment_export_duration;
                source_time = next_boundary;
                
                // Skip any cuts at the new position
                source_time = self.skip_cuts_forward(Timestamp::from_micros(source_time)).as_micros();
            }
        }

        // Ensure we don't exceed out_point
        Timestamp::from_micros(source_time.min(self.out_point.as_micros()))
    }

    /// Skip forward past any cut regions starting from the given timestamp.
    fn skip_cuts_forward(&self, ts: Timestamp) -> Timestamp {
        let mut current = ts.as_micros();
        
        loop {
            let current_ts = Timestamp::from_micros(current);
            if let Some(cut) = self.cuts.iter().find(|c| c.contains(current_ts)) {
                current = cut.end.as_micros();
            } else {
                break;
            }
        }

        Timestamp::from_micros(current.min(self.out_point.as_micros()))
    }

    /// Get the in point.
    pub fn in_point(&self) -> Timestamp {
        self.in_point
    }

    /// Get the out point.
    pub fn out_point(&self) -> Timestamp {
        self.out_point
    }

    /// Get the cuts.
    pub fn cuts(&self) -> &[TimeRange] {
        &self.cuts
    }

    /// Get the speed ramps.
    pub fn speed_ramps(&self) -> &[SpeedRamp] {
        &self.speed_ramps
    }
}

// =============================================================================
// WASM Bindings
// =============================================================================

/// Configuration for creating a TimeRemapper from JavaScript.
/// This is the JSON structure expected by `WasmTimeRemapper::new()`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRemapperConfig {
    /// Cut segments to remove from the export.
    #[serde(default)]
    pub cuts: Vec<TimeRangeConfig>,
    /// Speed ramp segments.
    #[serde(default)]
    pub speed_ramps: Vec<SpeedRampConfig>,
    /// In point (start of export) in microseconds.
    pub in_point_us: u64,
    /// Out point (end of export) in microseconds.
    pub out_point_us: u64,
}

/// JSON-friendly time range configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRangeConfig {
    /// Start time in microseconds.
    pub start_us: u64,
    /// End time in microseconds.
    pub end_us: u64,
}

/// JSON-friendly speed ramp configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedRampConfig {
    /// Start time in microseconds.
    pub start_us: u64,
    /// End time in microseconds.
    pub end_us: u64,
    /// Speed multiplier (0.25 to 4.0).
    pub speed: f32,
}

/// WASM-exposed TimeRemapper for JavaScript interop.
/// Provides time remapping calculations for the export pipeline.
///
/// # Example JSON Config
/// ```json
/// {
///   "cuts": [
///     { "start_us": 2000000, "end_us": 4000000 }
///   ],
///   "speed_ramps": [
///     { "start_us": 5000000, "end_us": 7000000, "speed": 2.0 }
///   ],
///   "in_point_us": 0,
///   "out_point_us": 10000000
/// }
/// ```
#[wasm_bindgen]
pub struct WasmTimeRemapper {
    inner: TimeRemapper,
}

#[wasm_bindgen]
impl WasmTimeRemapper {
    /// Create a new TimeRemapper from JSON configuration.
    ///
    /// # Arguments
    /// * `config_json` - JSON string with TimeRemapperConfig structure
    ///
    /// # Returns
    /// A new WasmTimeRemapper instance or an error if the config is invalid.
    #[wasm_bindgen(constructor)]
    pub fn new(config_json: &str) -> Result<WasmTimeRemapper, JsValue> {
        let config: TimeRemapperConfig = serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid TimeRemapper config: {}", e)))?;

        let cuts: Vec<TimeRange> = config
            .cuts
            .into_iter()
            .map(|c| {
                TimeRange::new(
                    Timestamp::from_micros(c.start_us),
                    Timestamp::from_micros(c.end_us),
                )
            })
            .collect();

        let speed_ramps: Vec<SpeedRamp> = config
            .speed_ramps
            .into_iter()
            .map(|r| {
                SpeedRamp::new(
                    TimeRange::new(
                        Timestamp::from_micros(r.start_us),
                        Timestamp::from_micros(r.end_us),
                    ),
                    r.speed,
                )
            })
            .collect();

        let inner = TimeRemapper::new(
            cuts,
            speed_ramps,
            Timestamp::from_micros(config.in_point_us),
            Timestamp::from_micros(config.out_point_us),
        );

        Ok(WasmTimeRemapper { inner })
    }

    /// Create an identity TimeRemapper with no cuts or speed ramps.
    ///
    /// # Arguments
    /// * `in_point_us` - Start time in microseconds
    /// * `out_point_us` - End time in microseconds
    #[wasm_bindgen]
    pub fn identity(in_point_us: u64, out_point_us: u64) -> WasmTimeRemapper {
        WasmTimeRemapper {
            inner: TimeRemapper::identity(
                Timestamp::from_micros(in_point_us),
                Timestamp::from_micros(out_point_us),
            ),
        }
    }

    /// Map export timestamp to source timestamp.
    ///
    /// Given a timestamp in the exported video, returns the corresponding
    /// timestamp in the source video, accounting for cuts and speed ramps.
    ///
    /// # Arguments
    /// * `export_time_us` - Export timestamp in microseconds
    ///
    /// # Returns
    /// Source timestamp in microseconds
    #[wasm_bindgen]
    pub fn to_source_time(&self, export_time_us: u64) -> u64 {
        self.inner
            .to_source_time(Timestamp::from_micros(export_time_us))
            .as_micros()
    }

    /// Calculate total export duration after cuts and speed changes.
    ///
    /// # Returns
    /// Export duration in microseconds
    #[wasm_bindgen]
    pub fn export_duration(&self) -> u64 {
        self.inner.export_duration().as_micros()
    }

    /// Check if a source timestamp is within a cut region.
    ///
    /// # Arguments
    /// * `source_time_us` - Source timestamp in microseconds
    ///
    /// # Returns
    /// `true` if the timestamp is within a cut region
    #[wasm_bindgen]
    pub fn is_cut(&self, source_time_us: u64) -> bool {
        self.inner.is_cut(Timestamp::from_micros(source_time_us))
    }

    /// Get playback speed at a source timestamp.
    ///
    /// # Arguments
    /// * `source_time_us` - Source timestamp in microseconds
    ///
    /// # Returns
    /// Speed multiplier (1.0 if no speed ramp is active)
    #[wasm_bindgen]
    pub fn speed_at(&self, source_time_us: u64) -> f32 {
        self.inner.speed_at(Timestamp::from_micros(source_time_us))
    }

    /// Get the in point (start of export).
    ///
    /// # Returns
    /// In point in microseconds
    #[wasm_bindgen]
    pub fn in_point(&self) -> u64 {
        self.inner.in_point().as_micros()
    }

    /// Get the out point (end of export).
    ///
    /// # Returns
    /// Out point in microseconds
    #[wasm_bindgen]
    pub fn out_point(&self) -> u64 {
        self.inner.out_point().as_micros()
    }

    /// Get the configuration as JSON.
    ///
    /// # Returns
    /// JSON string with the current configuration
    #[wasm_bindgen]
    pub fn to_json(&self) -> Result<String, JsValue> {
        let config = TimeRemapperConfig {
            cuts: self
                .inner
                .cuts()
                .iter()
                .map(|c| TimeRangeConfig {
                    start_us: c.start.as_micros(),
                    end_us: c.end.as_micros(),
                })
                .collect(),
            speed_ramps: self
                .inner
                .speed_ramps()
                .iter()
                .map(|r| SpeedRampConfig {
                    start_us: r.range.start.as_micros(),
                    end_us: r.range.end.as_micros(),
                    speed: r.speed,
                })
                .collect(),
            in_point_us: self.inner.in_point().as_micros(),
            out_point_us: self.inner.out_point().as_micros(),
        };

        serde_json::to_string(&config)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // =========================================================================
    // Property-Based Tests
    // =========================================================================

    /// **Validates: Requirements 3.5, 4.5**
    ///
    /// Property: Time Remapping Continuity
    /// For any sequence of export timestamps t1 < t2, the mapped source timestamps
    /// s1, s2 SHALL satisfy s1 <= s2 (monotonically increasing).
    ///
    /// This property ensures that the time remapper maintains temporal ordering
    /// regardless of cuts and speed ramps. If export time advances, source time
    /// must not go backwards.
    mod property_tests {
        use super::*;

        /// Strategy to generate valid TimeRange within bounds
        fn time_range_strategy(max_time: u64) -> impl Strategy<Value = TimeRange> {
            (0..max_time, 0..max_time).prop_map(move |(a, b)| {
                let (start, end) = if a <= b { (a, b) } else { (b, a) };
                // Ensure non-zero duration
                let end = end.max(start + 1);
                TimeRange::new(
                    Timestamp::from_micros(start),
                    Timestamp::from_micros(end.min(max_time)),
                )
            })
        }

        /// Strategy to generate valid SpeedRamp within bounds
        fn speed_ramp_strategy(max_time: u64) -> impl Strategy<Value = SpeedRamp> {
            (time_range_strategy(max_time), 0.25f32..=4.0f32).prop_map(|(range, speed)| {
                SpeedRamp::new(range, speed)
            })
        }

        /// Strategy to generate a list of non-overlapping cuts
        fn cuts_strategy(max_time: u64, max_cuts: usize) -> impl Strategy<Value = Vec<TimeRange>> {
            prop::collection::vec(time_range_strategy(max_time), 0..=max_cuts).prop_map(|cuts| {
                // Sort and merge overlapping cuts to ensure valid configuration
                let mut sorted_cuts = cuts;
                sorted_cuts.sort_by_key(|c| c.start.as_micros());
                
                let mut merged: Vec<TimeRange> = Vec::new();
                for cut in sorted_cuts {
                    if let Some(last) = merged.last_mut() {
                        // If overlapping or adjacent, merge
                        if cut.start.as_micros() <= last.end.as_micros() {
                            last.end = Timestamp::from_micros(
                                last.end.as_micros().max(cut.end.as_micros())
                            );
                            continue;
                        }
                    }
                    merged.push(cut);
                }
                merged
            })
        }

        /// Strategy to generate a list of non-overlapping speed ramps
        fn speed_ramps_strategy(max_time: u64, max_ramps: usize) -> impl Strategy<Value = Vec<SpeedRamp>> {
            prop::collection::vec(speed_ramp_strategy(max_time), 0..=max_ramps).prop_map(|ramps| {
                // Sort and remove overlapping ramps (keep first)
                let mut sorted_ramps = ramps;
                sorted_ramps.sort_by(|a, b| a.range.start.cmp(&b.range.start));
                
                let mut non_overlapping: Vec<SpeedRamp> = Vec::new();
                for ramp in sorted_ramps {
                    let overlaps = non_overlapping.iter().any(|existing| {
                        ramp.range.start.as_micros() < existing.range.end.as_micros()
                            && ramp.range.end.as_micros() > existing.range.start.as_micros()
                    });
                    if !overlaps {
                        non_overlapping.push(ramp);
                    }
                }
                non_overlapping
            })
        }

        /// Strategy to generate a valid TimeRemapper configuration
        fn time_remapper_strategy() -> impl Strategy<Value = TimeRemapper> {
            // Use a reasonable max time (10 seconds in microseconds)
            let max_time = 10_000_000u64;
            
            (
                cuts_strategy(max_time, 5),
                speed_ramps_strategy(max_time, 5),
                0u64..max_time,  // in_point
                0u64..max_time,  // out_point offset
            ).prop_map(move |(cuts, speed_ramps, in_point, out_offset)| {
                // Ensure out_point > in_point
                let out_point = (in_point + out_offset + 1).min(max_time);
                TimeRemapper::new(
                    cuts,
                    speed_ramps,
                    Timestamp::from_micros(in_point),
                    Timestamp::from_micros(out_point),
                )
            })
        }

        /// Strategy to generate a TimeRemapper with cuts constrained to be within
        /// the trim region [in_point, out_point). This ensures cuts are relevant
        /// to the export and properly tests the cut exclusion property.
        fn time_remapper_with_valid_cuts_strategy() -> impl Strategy<Value = TimeRemapper> {
            // Use a reasonable max time (10 seconds in microseconds)
            let max_time = 10_000_000u64;
            
            // First generate in_point and out_point
            (0u64..max_time / 2, 1u64..max_time / 2).prop_flat_map(move |(in_point, duration)| {
                let out_point = in_point + duration;
                
                // Generate cuts within [in_point, out_point)
                let cuts_strat = prop::collection::vec(
                    (0u64..duration, 0u64..duration).prop_map(move |(a, b)| {
                        let (start, end) = if a <= b { (a, b) } else { (b, a) };
                        // Ensure non-zero duration and within bounds
                        let start = in_point + start;
                        let end = (in_point + end + 1).min(out_point);
                        TimeRange::new(
                            Timestamp::from_micros(start),
                            Timestamp::from_micros(end),
                        )
                    }),
                    0..=3
                ).prop_map(|cuts| {
                    // Sort and merge overlapping cuts
                    let mut sorted_cuts = cuts;
                    sorted_cuts.sort_by_key(|c| c.start.as_micros());
                    
                    let mut merged: Vec<TimeRange> = Vec::new();
                    for cut in sorted_cuts {
                        if let Some(last) = merged.last_mut() {
                            if cut.start.as_micros() <= last.end.as_micros() {
                                last.end = Timestamp::from_micros(
                                    last.end.as_micros().max(cut.end.as_micros())
                                );
                                continue;
                            }
                        }
                        merged.push(cut);
                    }
                    merged
                });
                
                // Generate speed ramps (can be anywhere, not constrained to trim region)
                let speed_ramps_strat = speed_ramps_strategy(max_time, 3);
                
                (Just(in_point), Just(out_point), cuts_strat, speed_ramps_strat)
            }).prop_map(|(in_point, out_point, cuts, speed_ramps)| {
                TimeRemapper::new(
                    cuts,
                    speed_ramps,
                    Timestamp::from_micros(in_point),
                    Timestamp::from_micros(out_point),
                )
            })
        }

        /// Strategy to generate a sorted sequence of export timestamps
        fn sorted_export_times_strategy(count: usize, max_time: u64) -> impl Strategy<Value = Vec<u64>> {
            prop::collection::vec(0u64..max_time, count).prop_map(|mut times| {
                times.sort();
                times
            })
        }

        proptest! {
            /// Property: Time Remapping Continuity
            /// For any sequence of increasing export timestamps, the mapped source
            /// timestamps must be monotonically increasing (non-decreasing).
            ///
            /// **Validates: Requirements 3.5, 4.5**
            #[test]
            fn time_remapping_is_monotonic(
                remapper in time_remapper_strategy(),
                export_times in sorted_export_times_strategy(10, 10_000_000u64)
            ) {
                let export_duration = remapper.export_duration().as_micros();
                
                // Filter export times to be within valid export duration
                let valid_export_times: Vec<u64> = export_times
                    .into_iter()
                    .filter(|&t| t <= export_duration)
                    .collect();
                
                // Map all export times to source times
                let source_times: Vec<u64> = valid_export_times
                    .iter()
                    .map(|&t| remapper.to_source_time(Timestamp::from_micros(t)).as_micros())
                    .collect();
                
                // Verify monotonicity: each source time should be >= previous
                for i in 1..source_times.len() {
                    prop_assert!(
                        source_times[i] >= source_times[i - 1],
                        "Time remapping continuity violated: source_time[{}]={} < source_time[{}]={} \
                         for export_times {:?}",
                        i, source_times[i], i - 1, source_times[i - 1],
                        valid_export_times
                    );
                }
            }

            /// Property: Strictly increasing export times map to non-decreasing source times
            /// This tests with strictly increasing (no duplicates) export timestamps.
            ///
            /// **Validates: Requirements 3.5, 4.5**
            #[test]
            fn strictly_increasing_export_maps_to_nondecreasing_source(
                remapper in time_remapper_strategy(),
            ) {
                let export_duration = remapper.export_duration().as_micros();
                
                // Skip if export duration is too small
                if export_duration < 100 {
                    return Ok(());
                }
                
                // Generate strictly increasing export timestamps
                let step = export_duration / 10;
                let export_times: Vec<u64> = (0..10)
                    .map(|i| i * step)
                    .filter(|&t| t <= export_duration)
                    .collect();
                
                // Map to source times
                let source_times: Vec<u64> = export_times
                    .iter()
                    .map(|&t| remapper.to_source_time(Timestamp::from_micros(t)).as_micros())
                    .collect();
                
                // Verify monotonicity
                for i in 1..source_times.len() {
                    prop_assert!(
                        source_times[i] >= source_times[i - 1],
                        "Continuity violated at index {}: source[{}]={} < source[{}]={}",
                        i, i, source_times[i], i - 1, source_times[i - 1]
                    );
                }
            }

            /// Property: Adjacent export timestamps map to adjacent or same source timestamps
            /// Tests that small increments in export time don't cause large jumps backward.
            ///
            /// **Validates: Requirements 3.5, 4.5**
            #[test]
            fn adjacent_export_times_maintain_order(
                remapper in time_remapper_strategy(),
                base_export_time in 0u64..10_000_000u64,
                delta in 1u64..1000u64,
            ) {
                let export_duration = remapper.export_duration().as_micros();
                
                // Ensure both times are within valid range
                if base_export_time >= export_duration {
                    return Ok(());
                }
                
                let t1 = base_export_time;
                let t2 = (base_export_time + delta).min(export_duration);
                
                let s1 = remapper.to_source_time(Timestamp::from_micros(t1)).as_micros();
                let s2 = remapper.to_source_time(Timestamp::from_micros(t2)).as_micros();
                
                prop_assert!(
                    s2 >= s1,
                    "Adjacent time continuity violated: export {} -> source {}, export {} -> source {}",
                    t1, s1, t2, s2
                );
            }

            /// Property: Cut Segment Exclusion
            /// For any cut segment [start, end] and export, no source timestamp within
            /// [start, end] SHALL be rendered.
            ///
            /// This property ensures that cut segments are properly excluded from the
            /// export. When mapping any valid export timestamp to a source timestamp,
            /// the resulting source timestamp must NOT fall within any cut region.
            ///
            /// **Validates: Requirements 3.5**
            #[test]
            fn cut_segments_are_excluded_from_export(
                remapper in time_remapper_with_valid_cuts_strategy(),
                export_time_ratio in 0.0f64..=1.0f64,
            ) {
                let export_duration = remapper.export_duration().as_micros();
                
                // Skip if export duration is zero (all content is cut)
                if export_duration == 0 {
                    return Ok(());
                }
                
                // Generate an export timestamp within the valid export duration
                let export_time = (export_time_ratio * export_duration as f64).round() as u64;
                let export_time = export_time.min(export_duration);
                
                // Map export time to source time
                let source_time = remapper.to_source_time(Timestamp::from_micros(export_time));
                
                // Only check cuts that are within the trimmed region
                // Cuts outside [in_point, out_point) don't affect the export
                let in_point = remapper.in_point().as_micros();
                let out_point = remapper.out_point().as_micros();
                
                let is_in_relevant_cut = remapper.cuts().iter().any(|cut| {
                    // A cut is relevant if it overlaps with [in_point, out_point)
                    let cut_start = cut.start.as_micros();
                    let cut_end = cut.end.as_micros();
                    cut_start < out_point && cut_end > in_point && cut.contains(source_time)
                });
                
                prop_assert!(
                    !is_in_relevant_cut,
                    "Cut segment exclusion violated: export_time={} mapped to source_time={} \
                     which falls within a cut segment. Cuts: {:?}, in_point: {}, out_point: {}",
                    export_time,
                    source_time.as_micros(),
                    remapper.cuts(),
                    in_point,
                    out_point
                );
            }

            /// Property: Cut Segment Exclusion - Multiple Export Timestamps
            /// Tests that multiple export timestamps across the entire export duration
            /// all map to source timestamps outside of cut regions.
            ///
            /// **Validates: Requirements 3.5**
            #[test]
            fn all_export_timestamps_avoid_cuts(
                remapper in time_remapper_with_valid_cuts_strategy(),
            ) {
                let export_duration = remapper.export_duration().as_micros();
                
                // Skip if export duration is zero
                if export_duration == 0 {
                    return Ok(());
                }
                
                let in_point = remapper.in_point().as_micros();
                let out_point = remapper.out_point().as_micros();
                
                // Sample export timestamps across the entire export duration
                let num_samples = 20;
                let step = export_duration / num_samples.max(1);
                
                for i in 0..=num_samples {
                    let export_time = (i * step).min(export_duration);
                    let source_time = remapper.to_source_time(Timestamp::from_micros(export_time));
                    
                    // Only check cuts that are within the trimmed region
                    let is_in_relevant_cut = remapper.cuts().iter().any(|cut| {
                        let cut_start = cut.start.as_micros();
                        let cut_end = cut.end.as_micros();
                        cut_start < out_point && cut_end > in_point && cut.contains(source_time)
                    });
                    
                    prop_assert!(
                        !is_in_relevant_cut,
                        "Cut segment exclusion violated at sample {}: export_time={} \
                         mapped to source_time={} which is within a cut. Cuts: {:?}",
                        i,
                        export_time,
                        source_time.as_micros(),
                        remapper.cuts()
                    );
                }
            }

            /// Property: Cut Segment Exclusion - Boundary Testing
            /// Tests that export timestamps near cut boundaries correctly avoid
            /// mapping into cut regions.
            ///
            /// **Validates: Requirements 3.5**
            #[test]
            fn cut_boundaries_are_respected(
                remapper in time_remapper_with_valid_cuts_strategy(),
                boundary_offset in 0u64..1000u64,
            ) {
                let export_duration = remapper.export_duration().as_micros();
                let cuts = remapper.cuts();
                
                // Skip if no cuts or zero export duration
                if cuts.is_empty() || export_duration == 0 {
                    return Ok(());
                }
                
                let in_point = remapper.in_point().as_micros();
                let out_point = remapper.out_point().as_micros();
                
                // Test various export timestamps
                for export_time in [0, boundary_offset, export_duration / 2, export_duration.saturating_sub(boundary_offset), export_duration] {
                    if export_time > export_duration {
                        continue;
                    }
                    
                    let source_time = remapper.to_source_time(Timestamp::from_micros(export_time));
                    
                    // Only check cuts that are within the trimmed region
                    let is_in_relevant_cut = cuts.iter().any(|cut| {
                        let cut_start = cut.start.as_micros();
                        let cut_end = cut.end.as_micros();
                        cut_start < out_point && cut_end > in_point && cut.contains(source_time)
                    });
                    
                    prop_assert!(
                        !is_in_relevant_cut,
                        "Cut boundary violation: export_time={} mapped to source_time={} \
                         which is within a cut segment. Cuts: {:?}",
                        export_time,
                        source_time.as_micros(),
                        cuts
                    );
                }
            }

            /// Property: Speed Ramp Duration
            /// For any speed ramp with source duration D and speed S, the export duration
            /// for that segment SHALL be D / S.
            ///
            /// This property validates that speed ramps correctly calculate their export
            /// duration based on the formula: export_duration = source_duration / speed.
            /// - At 2x speed, a 4 second source segment becomes 2 seconds in export
            /// - At 0.5x speed (slow-mo), a 2 second source segment becomes 4 seconds in export
            ///
            /// **Validates: Requirements 4.5**
            #[test]
            fn speed_ramp_duration_equals_source_divided_by_speed(
                source_duration_us in 1u64..10_000_000u64,  // 1 microsecond to 10 seconds
                speed in 0.25f32..=4.0f32,  // Valid speed range
            ) {
                // Create a speed ramp with the given duration and speed
                let range = TimeRange::new(
                    Timestamp::from_micros(0),
                    Timestamp::from_micros(source_duration_us),
                );
                let ramp = SpeedRamp::new(range, speed);
                
                // Calculate expected export duration: D / S
                let expected_export_duration = (source_duration_us as f64 / speed as f64).round() as u64;
                
                // Get actual export duration from the SpeedRamp
                let actual_export_duration = ramp.export_duration();
                
                // Verify the property: export_duration = source_duration / speed
                prop_assert_eq!(
                    actual_export_duration,
                    expected_export_duration,
                    "Speed ramp duration property violated: \
                     source_duration={} us, speed={}, \
                     expected export_duration={} us, actual={} us",
                    source_duration_us,
                    speed,
                    expected_export_duration,
                    actual_export_duration
                );
            }

            /// Property: Speed Ramp Duration in TimeRemapper
            /// When a TimeRemapper contains a single speed ramp covering the entire
            /// source duration, the total export duration SHALL equal source_duration / speed.
            ///
            /// This tests the integration of speed ramp duration calculation within
            /// the TimeRemapper's export_duration() method.
            ///
            /// **Validates: Requirements 4.5**
            #[test]
            fn time_remapper_speed_ramp_duration_is_correct(
                source_duration_us in 1000u64..10_000_000u64,  // At least 1ms to avoid edge cases
                speed in 0.25f32..=4.0f32,
            ) {
                // Create a TimeRemapper with a single speed ramp covering the entire duration
                let speed_ramps = vec![
                    SpeedRamp::new(
                        TimeRange::new(
                            Timestamp::from_micros(0),
                            Timestamp::from_micros(source_duration_us),
                        ),
                        speed,
                    ),
                ];
                
                let remapper = TimeRemapper::new(
                    vec![],  // No cuts
                    speed_ramps,
                    Timestamp::from_micros(0),
                    Timestamp::from_micros(source_duration_us),
                );
                
                // Calculate expected export duration
                let expected_export_duration = (source_duration_us as f64 / speed as f64).round() as u64;
                
                // Get actual export duration from TimeRemapper
                let actual_export_duration = remapper.export_duration().as_micros();
                
                // Allow for small floating-point rounding differences (within 1 microsecond)
                let diff = if actual_export_duration > expected_export_duration {
                    actual_export_duration - expected_export_duration
                } else {
                    expected_export_duration - actual_export_duration
                };
                
                prop_assert!(
                    diff <= 1,
                    "TimeRemapper speed ramp duration property violated: \
                     source_duration={} us, speed={}, \
                     expected export_duration={} us, actual={} us, diff={} us",
                    source_duration_us,
                    speed,
                    expected_export_duration,
                    actual_export_duration,
                    diff
                );
            }

            /// Property: Speed Ramp Duration - Partial Coverage
            /// When a speed ramp covers only part of the source, the export duration
            /// SHALL be: (non-ramped duration) + (ramped duration / speed).
            ///
            /// This tests that partial speed ramps correctly affect only their segment.
            ///
            /// **Validates: Requirements 4.5**
            #[test]
            fn partial_speed_ramp_duration_is_correct(
                total_duration_us in 2000u64..10_000_000u64,
                ramp_start_ratio in 0.1f64..0.4f64,
                ramp_end_ratio in 0.6f64..0.9f64,
                speed in 0.25f32..=4.0f32,
            ) {
                // Calculate ramp boundaries
                let ramp_start = (total_duration_us as f64 * ramp_start_ratio).round() as u64;
                let ramp_end = (total_duration_us as f64 * ramp_end_ratio).round() as u64;
                
                // Ensure valid range
                if ramp_start >= ramp_end {
                    return Ok(());
                }
                
                let speed_ramps = vec![
                    SpeedRamp::new(
                        TimeRange::new(
                            Timestamp::from_micros(ramp_start),
                            Timestamp::from_micros(ramp_end),
                        ),
                        speed,
                    ),
                ];
                
                let remapper = TimeRemapper::new(
                    vec![],
                    speed_ramps,
                    Timestamp::from_micros(0),
                    Timestamp::from_micros(total_duration_us),
                );
                
                // Calculate expected export duration:
                // - Before ramp: ramp_start (at 1x speed)
                // - During ramp: (ramp_end - ramp_start) / speed
                // - After ramp: total_duration - ramp_end (at 1x speed)
                let before_ramp = ramp_start as f64;
                let during_ramp = (ramp_end - ramp_start) as f64 / speed as f64;
                let after_ramp = (total_duration_us - ramp_end) as f64;
                let expected_export_duration = (before_ramp + during_ramp + after_ramp).round() as u64;
                
                let actual_export_duration = remapper.export_duration().as_micros();
                
                // Allow for small floating-point rounding differences
                let diff = if actual_export_duration > expected_export_duration {
                    actual_export_duration - expected_export_duration
                } else {
                    expected_export_duration - actual_export_duration
                };
                
                prop_assert!(
                    diff <= 2,  // Allow up to 2 microseconds for cumulative rounding
                    "Partial speed ramp duration property violated: \
                     total={} us, ramp=[{}, {}], speed={}, \
                     expected={} us, actual={} us, diff={} us",
                    total_duration_us,
                    ramp_start,
                    ramp_end,
                    speed,
                    expected_export_duration,
                    actual_export_duration,
                    diff
                );
            }
        }
    }

    // =========================================================================
    // Unit Tests
    // =========================================================================

    #[test]
    fn test_time_range_duration() {
        let range = TimeRange::new(
            Timestamp::from_micros(1_000_000),
            Timestamp::from_micros(3_000_000),
        );
        assert_eq!(range.duration(), 2_000_000);
    }

    #[test]
    fn test_time_range_contains() {
        let range = TimeRange::new(
            Timestamp::from_micros(1_000_000),
            Timestamp::from_micros(3_000_000),
        );
        assert!(range.contains(Timestamp::from_micros(1_000_000)));
        assert!(range.contains(Timestamp::from_micros(2_000_000)));
        assert!(!range.contains(Timestamp::from_micros(3_000_000))); // exclusive end
        assert!(!range.contains(Timestamp::from_micros(500_000)));
    }

    #[test]
    fn test_speed_ramp_export_duration() {
        let range = TimeRange::new(
            Timestamp::from_micros(0),
            Timestamp::from_micros(2_000_000),
        );
        
        // 2x speed: 2 seconds source -> 1 second export
        let ramp = SpeedRamp::new(range, 2.0);
        assert_eq!(ramp.export_duration(), 1_000_000);

        // 0.5x speed: 2 seconds source -> 4 seconds export
        let ramp = SpeedRamp::new(range, 0.5);
        assert_eq!(ramp.export_duration(), 4_000_000);
    }

    #[test]
    fn test_speed_ramp_clamps_speed() {
        let range = TimeRange::new(
            Timestamp::from_micros(0),
            Timestamp::from_micros(1_000_000),
        );
        
        // Speed below minimum should clamp to 0.25
        let ramp = SpeedRamp::new(range, 0.1);
        assert_eq!(ramp.speed, 0.25);

        // Speed above maximum should clamp to 4.0
        let ramp = SpeedRamp::new(range, 10.0);
        assert_eq!(ramp.speed, 4.0);
    }

    #[test]
    fn test_identity_remapper() {
        let remapper = TimeRemapper::identity(
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );
        
        // No cuts or speed ramps, so export duration equals source duration
        assert_eq!(remapper.export_duration().as_micros(), 10_000_000);
        
        // Source time equals export time
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(5_000_000)).as_micros(),
            5_000_000
        );
    }

    #[test]
    fn test_is_cut() {
        let cuts = vec![
            TimeRange::new(
                Timestamp::from_micros(2_000_000),
                Timestamp::from_micros(4_000_000),
            ),
        ];
        let remapper = TimeRemapper::new(
            cuts,
            vec![],
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        assert!(!remapper.is_cut(Timestamp::from_micros(1_000_000)));
        assert!(remapper.is_cut(Timestamp::from_micros(2_000_000)));
        assert!(remapper.is_cut(Timestamp::from_micros(3_000_000)));
        assert!(!remapper.is_cut(Timestamp::from_micros(4_000_000)));
        assert!(!remapper.is_cut(Timestamp::from_micros(5_000_000)));
    }

    #[test]
    fn test_speed_at() {
        let speed_ramps = vec![
            SpeedRamp::new(
                TimeRange::new(
                    Timestamp::from_micros(2_000_000),
                    Timestamp::from_micros(4_000_000),
                ),
                2.0,
            ),
        ];
        let remapper = TimeRemapper::new(
            vec![],
            speed_ramps,
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        assert_eq!(remapper.speed_at(Timestamp::from_micros(1_000_000)), 1.0);
        assert_eq!(remapper.speed_at(Timestamp::from_micros(2_000_000)), 2.0);
        assert_eq!(remapper.speed_at(Timestamp::from_micros(3_000_000)), 2.0);
        assert_eq!(remapper.speed_at(Timestamp::from_micros(4_000_000)), 1.0);
    }

    #[test]
    fn test_export_duration_with_cut() {
        // 10 second video with a 2 second cut (2s-4s)
        // Export duration should be 8 seconds
        let cuts = vec![
            TimeRange::new(
                Timestamp::from_micros(2_000_000),
                Timestamp::from_micros(4_000_000),
            ),
        ];
        let remapper = TimeRemapper::new(
            cuts,
            vec![],
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        assert_eq!(remapper.export_duration().as_micros(), 8_000_000);
    }

    #[test]
    fn test_export_duration_with_speed_ramp() {
        // 10 second video with 2x speed from 2s-4s
        // 0-2s: 2s at 1x = 2s export
        // 2-4s: 2s at 2x = 1s export
        // 4-10s: 6s at 1x = 6s export
        // Total: 9s export
        let speed_ramps = vec![
            SpeedRamp::new(
                TimeRange::new(
                    Timestamp::from_micros(2_000_000),
                    Timestamp::from_micros(4_000_000),
                ),
                2.0,
            ),
        ];
        let remapper = TimeRemapper::new(
            vec![],
            speed_ramps,
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        assert_eq!(remapper.export_duration().as_micros(), 9_000_000);
    }

    #[test]
    fn test_export_duration_with_slow_motion() {
        // 10 second video with 0.5x speed from 2s-4s
        // 0-2s: 2s at 1x = 2s export
        // 2-4s: 2s at 0.5x = 4s export
        // 4-10s: 6s at 1x = 6s export
        // Total: 12s export
        let speed_ramps = vec![
            SpeedRamp::new(
                TimeRange::new(
                    Timestamp::from_micros(2_000_000),
                    Timestamp::from_micros(4_000_000),
                ),
                0.5,
            ),
        ];
        let remapper = TimeRemapper::new(
            vec![],
            speed_ramps,
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        assert_eq!(remapper.export_duration().as_micros(), 12_000_000);
    }

    #[test]
    fn test_to_source_time_with_cut() {
        // 10 second video with a 2 second cut (2s-4s)
        let cuts = vec![
            TimeRange::new(
                Timestamp::from_micros(2_000_000),
                Timestamp::from_micros(4_000_000),
            ),
        ];
        let remapper = TimeRemapper::new(
            cuts,
            vec![],
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        // Export time 0 -> Source time 0
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(0)).as_micros(),
            0
        );

        // Export time 1s -> Source time 1s (before cut)
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(1_000_000)).as_micros(),
            1_000_000
        );

        // Export time 2s -> Source time 4s (after cut)
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(2_000_000)).as_micros(),
            4_000_000
        );

        // Export time 3s -> Source time 5s
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(3_000_000)).as_micros(),
            5_000_000
        );
    }

    #[test]
    fn test_to_source_time_with_speed_ramp() {
        // 10 second video with 2x speed from 2s-4s
        let speed_ramps = vec![
            SpeedRamp::new(
                TimeRange::new(
                    Timestamp::from_micros(2_000_000),
                    Timestamp::from_micros(4_000_000),
                ),
                2.0,
            ),
        ];
        let remapper = TimeRemapper::new(
            vec![],
            speed_ramps,
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        // Export time 0 -> Source time 0
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(0)).as_micros(),
            0
        );

        // Export time 2s -> Source time 2s (start of speed ramp)
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(2_000_000)).as_micros(),
            2_000_000
        );

        // Export time 2.5s -> Source time 3s (middle of 2x speed ramp)
        // 0.5s export at 2x speed = 1s source
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(2_500_000)).as_micros(),
            3_000_000
        );

        // Export time 3s -> Source time 4s (end of speed ramp)
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(3_000_000)).as_micros(),
            4_000_000
        );

        // Export time 4s -> Source time 5s (after speed ramp)
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(4_000_000)).as_micros(),
            5_000_000
        );
    }

    #[test]
    fn test_to_source_time_with_trim() {
        // Video trimmed from 2s to 8s (6 second export)
        let remapper = TimeRemapper::new(
            vec![],
            vec![],
            Timestamp::from_micros(2_000_000),
            Timestamp::from_micros(8_000_000),
        );

        // Export time 0 -> Source time 2s (in_point)
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(0)).as_micros(),
            2_000_000
        );

        // Export time 3s -> Source time 5s
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(3_000_000)).as_micros(),
            5_000_000
        );

        // Export time 6s -> Source time 8s (out_point)
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(6_000_000)).as_micros(),
            8_000_000
        );
    }

    #[test]
    fn test_combined_cut_and_speed_ramp() {
        // 10 second video:
        // - Cut from 2s-3s (1 second removed)
        // - 2x speed from 5s-7s (2 seconds source -> 1 second export)
        // Export duration: 10 - 1 - 1 = 8 seconds
        let cuts = vec![
            TimeRange::new(
                Timestamp::from_micros(2_000_000),
                Timestamp::from_micros(3_000_000),
            ),
        ];
        let speed_ramps = vec![
            SpeedRamp::new(
                TimeRange::new(
                    Timestamp::from_micros(5_000_000),
                    Timestamp::from_micros(7_000_000),
                ),
                2.0,
            ),
        ];
        let remapper = TimeRemapper::new(
            cuts,
            speed_ramps,
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        assert_eq!(remapper.export_duration().as_micros(), 8_000_000);
    }

    #[test]
    fn test_multiple_cuts() {
        // 10 second video with two cuts:
        // - Cut from 1s-2s (1 second)
        // - Cut from 5s-7s (2 seconds)
        // Export duration: 10 - 1 - 2 = 7 seconds
        let cuts = vec![
            TimeRange::new(
                Timestamp::from_micros(1_000_000),
                Timestamp::from_micros(2_000_000),
            ),
            TimeRange::new(
                Timestamp::from_micros(5_000_000),
                Timestamp::from_micros(7_000_000),
            ),
        ];
        let remapper = TimeRemapper::new(
            cuts,
            vec![],
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        assert_eq!(remapper.export_duration().as_micros(), 7_000_000);

        // Export time 0 -> Source time 0
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(0)).as_micros(),
            0
        );

        // Export time 1s -> Source time 2s (after first cut)
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(1_000_000)).as_micros(),
            2_000_000
        );

        // Export time 4s -> Source time 7s (after both cuts)
        // 0-1s source (1s export) + skip 1-2s + 2-5s source (3s export) = 4s export -> 5s source
        // But 5s is in cut, so skip to 7s
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(4_000_000)).as_micros(),
            7_000_000
        );
    }

    #[test]
    fn test_cut_at_start() {
        // Cut at the very beginning
        let cuts = vec![
            TimeRange::new(
                Timestamp::from_micros(0),
                Timestamp::from_micros(2_000_000),
            ),
        ];
        let remapper = TimeRemapper::new(
            cuts,
            vec![],
            Timestamp::from_micros(0),
            Timestamp::from_micros(10_000_000),
        );

        // Export time 0 should skip to after the cut
        assert_eq!(
            remapper.to_source_time(Timestamp::from_micros(0)).as_micros(),
            2_000_000
        );

        assert_eq!(remapper.export_duration().as_micros(), 8_000_000);
    }

    // =========================================================================
    // WASM Wrapper Tests
    // =========================================================================

    #[test]
    fn test_wasm_time_remapper_from_json() {
        let config_json = r#"{
            "cuts": [
                { "start_us": 2000000, "end_us": 4000000 }
            ],
            "speed_ramps": [
                { "start_us": 5000000, "end_us": 7000000, "speed": 2.0 }
            ],
            "in_point_us": 0,
            "out_point_us": 10000000
        }"#;

        let remapper = WasmTimeRemapper::new(config_json).expect("Should parse valid config");

        // 10s - 2s cut - 1s (2s at 2x speed) = 7s export
        assert_eq!(remapper.export_duration(), 7_000_000);
        assert_eq!(remapper.in_point(), 0);
        assert_eq!(remapper.out_point(), 10_000_000);
    }

    #[test]
    fn test_wasm_time_remapper_identity() {
        let remapper = WasmTimeRemapper::identity(0, 10_000_000);

        assert_eq!(remapper.export_duration(), 10_000_000);
        assert_eq!(remapper.to_source_time(5_000_000), 5_000_000);
        assert!(!remapper.is_cut(5_000_000));
        assert_eq!(remapper.speed_at(5_000_000), 1.0);
    }

    #[test]
    fn test_wasm_time_remapper_to_source_time() {
        let config_json = r#"{
            "cuts": [
                { "start_us": 2000000, "end_us": 4000000 }
            ],
            "speed_ramps": [],
            "in_point_us": 0,
            "out_point_us": 10000000
        }"#;

        let remapper = WasmTimeRemapper::new(config_json).expect("Should parse valid config");

        // Export time 0 -> Source time 0
        assert_eq!(remapper.to_source_time(0), 0);

        // Export time 1s -> Source time 1s (before cut)
        assert_eq!(remapper.to_source_time(1_000_000), 1_000_000);

        // Export time 2s -> Source time 4s (after cut)
        assert_eq!(remapper.to_source_time(2_000_000), 4_000_000);
    }

    #[test]
    fn test_wasm_time_remapper_is_cut() {
        let config_json = r#"{
            "cuts": [
                { "start_us": 2000000, "end_us": 4000000 }
            ],
            "speed_ramps": [],
            "in_point_us": 0,
            "out_point_us": 10000000
        }"#;

        let remapper = WasmTimeRemapper::new(config_json).expect("Should parse valid config");

        assert!(!remapper.is_cut(1_000_000));
        assert!(remapper.is_cut(2_000_000));
        assert!(remapper.is_cut(3_000_000));
        assert!(!remapper.is_cut(4_000_000));
    }

    #[test]
    fn test_wasm_time_remapper_speed_at() {
        let config_json = r#"{
            "cuts": [],
            "speed_ramps": [
                { "start_us": 2000000, "end_us": 4000000, "speed": 2.0 }
            ],
            "in_point_us": 0,
            "out_point_us": 10000000
        }"#;

        let remapper = WasmTimeRemapper::new(config_json).expect("Should parse valid config");

        assert_eq!(remapper.speed_at(1_000_000), 1.0);
        assert_eq!(remapper.speed_at(2_000_000), 2.0);
        assert_eq!(remapper.speed_at(3_000_000), 2.0);
        assert_eq!(remapper.speed_at(4_000_000), 1.0);
    }

    #[test]
    fn test_wasm_time_remapper_to_json() {
        let config_json = r#"{
            "cuts": [
                { "start_us": 2000000, "end_us": 4000000 }
            ],
            "speed_ramps": [
                { "start_us": 5000000, "end_us": 7000000, "speed": 2.0 }
            ],
            "in_point_us": 0,
            "out_point_us": 10000000
        }"#;

        let remapper = WasmTimeRemapper::new(config_json).expect("Should parse valid config");
        let output_json = remapper.to_json().expect("Should serialize to JSON");

        // Parse the output and verify it contains the expected data
        let output: TimeRemapperConfig =
            serde_json::from_str(&output_json).expect("Should parse output JSON");

        assert_eq!(output.cuts.len(), 1);
        assert_eq!(output.cuts[0].start_us, 2_000_000);
        assert_eq!(output.cuts[0].end_us, 4_000_000);
        assert_eq!(output.speed_ramps.len(), 1);
        assert_eq!(output.speed_ramps[0].start_us, 5_000_000);
        assert_eq!(output.speed_ramps[0].end_us, 7_000_000);
        assert_eq!(output.speed_ramps[0].speed, 2.0);
        assert_eq!(output.in_point_us, 0);
        assert_eq!(output.out_point_us, 10_000_000);
    }

    // Note: test_wasm_time_remapper_invalid_json is only testable in wasm32 target
    // because JsValue::from_str is not available on non-wasm32 targets.
    // The error handling is tested implicitly through the WASM build.

    #[test]
    fn test_wasm_time_remapper_empty_config() {
        let config_json = r#"{
            "cuts": [],
            "speed_ramps": [],
            "in_point_us": 0,
            "out_point_us": 5000000
        }"#;

        let remapper = WasmTimeRemapper::new(config_json).expect("Should parse valid config");

        assert_eq!(remapper.export_duration(), 5_000_000);
        assert_eq!(remapper.to_source_time(2_500_000), 2_500_000);
    }
}


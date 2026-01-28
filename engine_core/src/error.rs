// Typed errors with thiserror. Surface meaningful messages to JS.
// See steering.md: Rust Rules (Engine)

use thiserror::Error;

/// Engine error types.
#[derive(Error, Debug)]
pub enum EngineError {
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Signal processing error: {0}")]
    SignalProcessing(String),

    #[error("Cursor detection failed: {0}")]
    CursorDetection(String),

    #[error("Frame analysis error at frame {frame_index}: {message}")]
    FrameAnalysis { frame_index: u32, message: String },

    #[error("Keyframe generation error: {0}")]
    KeyframeGeneration(String),

    #[error("Serialization error: {0}")]
    Serialization(String),
}

impl From<serde_json::Error> for EngineError {
    fn from(err: serde_json::Error) -> Self {
        EngineError::Serialization(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_display() {
        let err = EngineError::InvalidConfig("missing field".to_string());
        assert!(err.to_string().contains("missing field"));
    }
}

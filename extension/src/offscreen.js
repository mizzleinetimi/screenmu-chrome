// Offscreen document for MediaRecorder
// Required in MV3 because service workers cannot use MediaRecorder
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

let screenRecorder = null;
let micRecorder = null;
let cameraRecorder = null;
let screenChunks = [];
let micChunks = [];
let cameraChunks = [];

// Timestamp tracking for synchronization
let recordingStartTime = 0;

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;

    switch (message.type) {
        case 'START_RECORDING':
            startRecording(message.streamId, message.options || {})
                .then(() => sendResponse({ success: true }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;

        case 'STOP_RECORDING':
            stopRecording()
                .then((data) => sendResponse({ success: true, ...data }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;

        case 'PAUSE_RECORDING':
            if (screenRecorder && screenRecorder.state === 'recording') {
                screenRecorder.pause();
            }
            if (micRecorder && micRecorder.state === 'recording') {
                micRecorder.pause();
            }
            if (cameraRecorder && cameraRecorder.state === 'recording') {
                cameraRecorder.pause();
            }
            sendResponse({ success: true });
            break;

        case 'RESUME_RECORDING':
            if (screenRecorder && screenRecorder.state === 'paused') {
                screenRecorder.resume();
            }
            if (micRecorder && micRecorder.state === 'paused') {
                micRecorder.resume();
            }
            if (cameraRecorder && cameraRecorder.state === 'paused') {
                cameraRecorder.resume();
            }
            sendResponse({ success: true });
            break;

        default:
            break;
    }
    return false;
});

async function startRecording(streamId, options = {}) {
    // Get the tab stream from the stream ID
    const tabStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId,
            },
        },
        video: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId,
                maxWidth: 1920,
                maxHeight: 1080,
            },
        },
    });

    screenChunks = [];
    micChunks = [];
    cameraChunks = [];

    // Prepare all streams BEFORE starting any recorders
    // This minimizes the time gap between recorder starts
    let micStream = null;
    let cameraStream = null;

    // Get microphone stream if permission was granted
    if (options.hasMic) {
        try {
            // Use higher quality audio settings for clearer capture
            // Disable processing that can degrade quality for voiceover-style recording
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    // Higher sample rate for better quality
                    sampleRate: { ideal: 48000 },
                    sampleSize: { ideal: 16 },
                    channelCount: { ideal: 1 },
                    // Disable processing for cleaner audio
                    // These can cause artifacts and reduce clarity
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                }
            });
            console.log('[ScreenMu Offscreen] Microphone stream acquired');
        } catch (err) {
            console.warn('[ScreenMu Offscreen] Microphone access failed:', err);
        }
    }

    // Get camera stream if permission was granted
    if (options.hasCamera) {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user',
                }
            });
            console.log('[ScreenMu Offscreen] Camera stream acquired');
        } catch (err) {
            console.warn('[ScreenMu Offscreen] Camera access failed:', err);
        }
    }

    // Create all recorders
    screenRecorder = new MediaRecorder(tabStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
    });

    screenRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            screenChunks.push(e.data);
        }
    };

    if (micStream) {
        // Use higher bitrate for better audio quality
        micRecorder = new MediaRecorder(micStream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000, // 128kbps for good quality
        });

        micRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                micChunks.push(e.data);
            }
        };
    }

    if (cameraStream) {
        cameraRecorder = new MediaRecorder(cameraStream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 2000000,
        });

        cameraRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                cameraChunks.push(e.data);
            }
        };
    }

    // Start all recorders at the same time for better sync
    // Use a common reference timestamp
    recordingStartTime = performance.now();
    
    // Start all recorders in quick succession
    // The timeslice of 100ms means data is collected frequently for smoother playback
    screenRecorder.start(100);
    if (micRecorder) {
        micRecorder.start(100);
    }
    if (cameraRecorder) {
        cameraRecorder.start(100);
    }

    console.log('[ScreenMu Offscreen] All recorders started at:', recordingStartTime);
}

async function stopRecording() {
    const results = {};

    // Stop screen
    if (screenRecorder) {
        await new Promise((resolve) => {
            screenRecorder.onstop = async () => {
                screenRecorder.stream.getTracks().forEach((track) => track.stop());
                const blob = new Blob(screenChunks, { type: 'video/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                await new Promise(r => reader.onloadend = r);
                results.screenVideoBase64 = reader.result;
                results.screenSize = blob.size;
                screenChunks = [];
                screenRecorder = null;
                console.log('[ScreenMu Offscreen] Screen recording stopped, size:', blob.size);
                resolve();
            };
            screenRecorder.stop();
        });
    }

    // Stop mic
    if (micRecorder) {
        await new Promise((resolve) => {
            micRecorder.onstop = async () => {
                micRecorder.stream.getTracks().forEach((track) => track.stop());
                const blob = new Blob(micChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                await new Promise(r => reader.onloadend = r);
                results.audioBase64 = reader.result;
                results.audioSize = blob.size;
                micChunks = [];
                micRecorder = null;
                console.log('[ScreenMu Offscreen] Mic recording stopped, size:', blob.size);
                resolve();
            };
            micRecorder.stop();
        });
    }

    // Stop camera
    if (cameraRecorder) {
        await new Promise((resolve) => {
            cameraRecorder.onstop = async () => {
                cameraRecorder.stream.getTracks().forEach((track) => track.stop());
                const blob = new Blob(cameraChunks, { type: 'video/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                await new Promise(r => reader.onloadend = r);
                results.cameraVideoBase64 = reader.result;
                results.cameraSize = blob.size;
                cameraChunks = [];
                cameraRecorder = null;
                console.log('[ScreenMu Offscreen] Camera recording stopped, size:', blob.size);
                resolve();
            };
            cameraRecorder.stop();
        });
    }

    return results;
}

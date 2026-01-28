// Offscreen document for MediaRecorder
// Required in MV3 because service workers cannot use MediaRecorder
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

let screenRecorder = null;
let micRecorder = null;
let cameraRecorder = null;
let screenChunks = [];
let micChunks = [];
let cameraChunks = [];

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

    // Start screen recording
    screenRecorder = new MediaRecorder(tabStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
    });

    screenRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            screenChunks.push(e.data);
        }
    };

    screenRecorder.start(100);
    console.log('[ScreenMu Offscreen] Screen recording started');

    // Try to start microphone recording
    try {
        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            }
        });

        micRecorder = new MediaRecorder(micStream, {
            mimeType: 'audio/webm;codecs=opus',
        });

        micRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                micChunks.push(e.data);
            }
        };

        micRecorder.start(100);
        console.log('[ScreenMu Offscreen] Microphone recording started');
    } catch (err) {
        console.warn('[ScreenMu Offscreen] Microphone access denied or failed:', err);
        // Continue without mic
    }

    // Try to start camera recording
    try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
            }
        });

        cameraRecorder = new MediaRecorder(cameraStream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 2000000,
        });

        cameraRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                cameraChunks.push(e.data);
            }
        };

        cameraRecorder.start(100);
        console.log('[ScreenMu Offscreen] Camera recording started');
    } catch (err) {
        console.warn('[ScreenMu Offscreen] Camera access denied or failed:', err);
        // Continue without camera
    }
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

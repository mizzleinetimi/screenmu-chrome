// Background service worker for Chrome Extension
// See steering.md: Extension handles capture and permissions, not "the intelligence"
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

let isRecording = false;
let recordingTabId = null;
let startTime = 0;

// Pending permission request state
let pendingCaptureTabId = null;
let pendingPermissions = { hasMic: false, hasCamera: false };

// Store for accumulated signals
const recordingData = {
    signals: [],
    startTime: 0,
};

// Handle messages from content scripts and permissions page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'TAB_READY':
            console.log('[ScreenMu] Tab ready:', sender.tab?.id);
            sendResponse({ success: true });
            break;

        case 'SIGNAL_BATCH':
            if (isRecording && sender.tab?.id === recordingTabId) {
                recordingData.signals.push(...message.signals);
            }
            sendResponse({ success: true });
            break;

        case 'PERMISSIONS_RESULT':
            // Received from permissions.html page
            console.log('[ScreenMu BG] Permissions result:', message.hasMic, message.hasCamera);
            pendingPermissions = { hasMic: message.hasMic, hasCamera: message.hasCamera };
            // Close the permissions tab
            if (sender.tab?.id) {
                chrome.tabs.remove(sender.tab.id);
            }
            // Now start the actual recording
            if (pendingCaptureTabId !== null) {
                handleStartCapture(pendingCaptureTabId, pendingPermissions)
                    .then(() => console.log('[ScreenMu BG] Recording started after permissions'))
                    .catch(err => console.error('[ScreenMu BG] Start capture failed:', err));
                pendingCaptureTabId = null;
            }
            sendResponse({ success: true });
            break;

        case 'START_TAB_CAPTURE':
            // Legacy: First open permissions page, then start recording after result
            requestPermissionsAndCapture(sender.tab?.id, message.options || {})
                .then(() => sendResponse({ success: true }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true; // async response

        case 'START_TAB_CAPTURE_DIRECT':
            // New: Permissions already granted in popup, start directly
            handleStartCapture(null, message.options || {})
                .then(() => sendResponse({ success: true }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true; // async response

        case 'STOP_CAPTURE':
            handleStopCapture()
                .then((result) => sendResponse({ success: true, ...result }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true; // async response

        case 'PAUSE_CAPTURE':
            handlePauseCapture()
                .then(() => sendResponse({ success: true }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;

        case 'RESUME_CAPTURE':
            handleResumeCapture()
                .then(() => sendResponse({ success: true }))
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;

        case 'GET_STATUS':
            sendResponse({
                isRecording,
                duration: isRecording ? Date.now() - recordingData.startTime : 0,
                signalCount: recordingData.signals.length,
            });
            break;

        case 'OPEN_EDITOR':
            console.log('[ScreenMu BG] OPEN_EDITOR message received');
            console.log('[ScreenMu BG] latestRecording exists?', !!self.latestRecording);
            if (!self.latestRecording) {
                console.error('[ScreenMu BG] No recording found!');
                sendResponse({ success: false, error: 'No recording found' });
                return;
            }

            console.log('[ScreenMu BG] Calling handleOpenEditor...');
            handleOpenEditor(self.latestRecording)
                .then(() => {
                    console.log('[ScreenMu BG] handleOpenEditor completed');
                    sendResponse({ success: true });
                })
                .catch((err) => {
                    console.error('[ScreenMu BG] handleOpenEditor error:', err);
                    sendResponse({ success: false, error: err.message });
                });
            return true;

        default:
            break;
    }
    return false;
});

// Request permissions via dedicated page, then start capture
async function requestPermissionsAndCapture(tabId) {
    if (isRecording) {
        throw new Error('Already recording');
    }

    if (!tabId) {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tab?.id;
    }

    if (!tabId) {
        throw new Error('No active tab');
    }

    // Store the tab we want to record
    pendingCaptureTabId = tabId;

    // Open permissions page - it will request mic/camera and send PERMISSIONS_RESULT
    const permissionsUrl = chrome.runtime.getURL('permissions.html');
    await chrome.tabs.create({ url: permissionsUrl });

    console.log('[ScreenMu BG] Opened permissions page, waiting for result...');
}

// Start tab capture
async function handleStartCapture(tabId, options = {}) {
    if (isRecording) {
        throw new Error('Already recording');
    }

    if (!tabId) {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tab?.id;
    }

    if (!tabId) {
        throw new Error('No active tab');
    }

    // Ensure content script is ready before starting capture
    // Retry sending START_CAPTURE to content script with backoff
    let contentScriptReady = false;
    for (let i = 0; i < 10; i++) {
        try {
            await chrome.tabs.sendMessage(tabId, { type: 'PING' });
            contentScriptReady = true;
            console.log('[ScreenMu BG] Content script ready on attempt', i + 1);
            break;
        } catch (e) {
            console.log(`[ScreenMu BG] Content script not ready, attempt ${i + 1}/10`);
            // Try to inject content script if not present
            if (i === 0) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['src/content.js']
                    });
                    console.log('[ScreenMu BG] Injected content script');
                } catch (injectErr) {
                    console.log('[ScreenMu BG] Could not inject (may already exist):', injectErr.message);
                }
            }
            await new Promise(r => setTimeout(r, 300));
        }
    }

    if (!contentScriptReady) {
        throw new Error('Content script not responding. Please refresh the tab and try again.');
    }

    // Get tab capture stream ID
    const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tabId,
    });

    // Create offscreen document for recording
    await ensureOffscreenDocument();

    // Send stream to offscreen for recording (with permission flags)
    await chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        target: 'offscreen',
        streamId,
        options: {
            hasMic: options.hasMic || false,
            hasCamera: options.hasCamera || false,
        },
    });

    // Tell content script to start capturing signals
    await chrome.tabs.sendMessage(tabId, { type: 'START_CAPTURE' });

    // Update state
    isRecording = true;
    recordingTabId = tabId;
    recordingData.signals = [];
    recordingData.startTime = Date.now();

    console.log('[ScreenMu] Recording started on tab:', tabId);
}

// Pause capture
async function handlePauseCapture() {
    if (!isRecording) {
        throw new Error('Not recording');
    }

    // Tell content script to pause signal capture
    if (recordingTabId) {
        try {
            await chrome.tabs.sendMessage(recordingTabId, { type: 'PAUSE_CAPTURE' });
        } catch (e) {
            // Tab might be closed
        }
    }

    // Tell offscreen to pause recording
    await chrome.runtime.sendMessage({
        type: 'PAUSE_RECORDING',
        target: 'offscreen',
    });

    console.log('[ScreenMu] Recording paused');
}

// Resume capture
async function handleResumeCapture() {
    if (!isRecording) {
        throw new Error('Not recording');
    }

    // Tell content script to resume signal capture
    if (recordingTabId) {
        try {
            await chrome.tabs.sendMessage(recordingTabId, { type: 'RESUME_CAPTURE' });
        } catch (e) {
            // Tab might be closed
        }
    }

    // Tell offscreen to resume recording
    await chrome.runtime.sendMessage({
        type: 'RESUME_RECORDING',
        target: 'offscreen',
    });

    console.log('[ScreenMu] Recording resumed');
}

// Stop capture
async function handleStopCapture() {
    if (!isRecording) {
        throw new Error('Not recording');
    }

    // Tell content script to stop
    if (recordingTabId) {
        try {
            await chrome.tabs.sendMessage(recordingTabId, { type: 'STOP_CAPTURE' });
        } catch {
            // Tab might be closed
        }
    }

    // Tell offscreen to stop recording
    const result = await chrome.runtime.sendMessage({
        type: 'STOP_RECORDING',
        target: 'offscreen',
    });

    console.log('[ScreenMu BG] Received from offscreen:', Object.keys(result));
    console.log('[ScreenMu BG] Screen video:', result.screenVideoBase64?.length, 'bytes');
    console.log('[ScreenMu BG] Audio:', result.audioBase64?.length || 'none');
    console.log('[ScreenMu BG] Camera:', result.cameraVideoBase64?.length || 'none');

    // Convert screen video base64 back to Blob (required)
    const screenRes = await fetch(result.screenVideoBase64);
    const videoBlob = await screenRes.blob();
    console.log('[ScreenMu BG] Screen blob size:', videoBlob.size);

    // Convert audio base64 to Blob (optional)
    let audioBlob = null;
    if (result.audioBase64) {
        const audioRes = await fetch(result.audioBase64);
        audioBlob = await audioRes.blob();
        console.log('[ScreenMu BG] Audio blob size:', audioBlob.size);
    }

    // Convert camera video base64 to Blob (optional)
    let cameraBlob = null;
    if (result.cameraVideoBase64) {
        const cameraRes = await fetch(result.cameraVideoBase64);
        cameraBlob = await cameraRes.blob();
        console.log('[ScreenMu BG] Camera blob size:', cameraBlob.size);
    }

    // Get final data
    const finalData = {
        signals: [...recordingData.signals],
        duration: Date.now() - recordingData.startTime,
    };

    // Reset state
    isRecording = false;
    recordingTabId = null;
    recordingData.signals = [];

    console.log('[ScreenMu] Recording stopped. Signals:', finalData.signals.length);

    // Store latest recording for export (with all 3 blobs)
    self.latestRecording = {
        videoBlob: videoBlob,
        audioBlob: audioBlob,        // May be null if mic denied
        cameraBlob: cameraBlob,      // May be null if camera denied
        signals: finalData.signals,
        duration: finalData.duration,
        timestamp: Date.now()
    };

    return finalData;
}

// Open editor and inject data
async function handleOpenEditor(recording) {
    console.log('[ScreenMu BG] handleOpenEditor called with recording:', recording);
    console.log('[ScreenMu BG] videoBlob type:', typeof recording.videoBlob);
    console.log('[ScreenMu BG] videoBlob instanceof Blob:', recording.videoBlob instanceof Blob);
    console.log('[ScreenMu BG] videoBlob size:', recording.videoBlob?.size);

    const editorUrl = 'http://localhost:5173/import-extension';

    // Open the editor tab
    const tab = await chrome.tabs.create({ url: editorUrl });

    // Wait for tab to load
    await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });

    // Give the page a moment to initialize React
    // Convert all blobs to base64 for transmission
    console.log('[ScreenMu BG] Converting blobs to base64...');

    // Screen video (required)
    const videoReader = new FileReader();
    videoReader.readAsDataURL(recording.videoBlob);
    await new Promise(resolve => videoReader.onloadend = resolve);
    const base64Video = videoReader.result;
    console.log('[ScreenMu BG] Screen video base64 length:', base64Video?.length);

    // Audio (optional)
    let base64Audio = null;
    if (recording.audioBlob) {
        const audioReader = new FileReader();
        audioReader.readAsDataURL(recording.audioBlob);
        await new Promise(resolve => audioReader.onloadend = resolve);
        base64Audio = audioReader.result;
        console.log('[ScreenMu BG] Audio base64 length:', base64Audio?.length);
    }

    // Camera (optional)
    let base64Camera = null;
    if (recording.cameraBlob) {
        const cameraReader = new FileReader();
        cameraReader.readAsDataURL(recording.cameraBlob);
        await new Promise(resolve => cameraReader.onloadend = resolve);
        base64Camera = cameraReader.result;
        console.log('[ScreenMu BG] Camera base64 length:', base64Camera?.length);
    }

    const message = {
        type: 'IMPORT_RECORDING_DATA',
        recording: {
            videoBase64: base64Video,
            audioBase64: base64Audio,      // May be null
            cameraBase64: base64Camera,    // May be null
            recordingData: {
                signals: recording.signals,
                duration: recording.duration,
                createdAt: recording.timestamp
            }
        }
    };

    // Retry loop: try sending every 1 second for 10 seconds
    for (let i = 0; i < 10; i++) {
        try {
            console.log(`[ScreenMu BG] Attempt ${i + 1} to send data to tab ${tab.id}`);
            await chrome.tabs.sendMessage(tab.id, message);
            console.log('[ScreenMu BG] Data sent successfully');
            break; // Success!
        } catch (e) {
            console.log(`[ScreenMu BG] Attempt ${i + 1} failed (tab not ready?):`, e.message);
            // Wait 1s before retry
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// Ensure offscreen document exists
async function ensureOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
    });

    if (existingContexts.length > 0) {
        return;
    }

    await chrome.offscreen.createDocument({
        url: 'src/offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Recording tab capture stream',
    });
}

// Listen for tab close
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === recordingTabId) {
        handleStopCapture().catch(console.error);
    }
});

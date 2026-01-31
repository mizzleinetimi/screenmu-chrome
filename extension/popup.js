// Popup script for ScreenMu extension
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

// Views
const idleView = document.getElementById('idle-view');
const recordingView = document.getElementById('recording-view');
const stoppedView = document.getElementById('stopped-view');

// Idle view elements
const startBtn = document.getElementById('startBtn');
const micToggle = document.getElementById('micToggle');
const cameraToggle = document.getElementById('cameraToggle');

// Recording view elements
const timerDisplay = document.getElementById('timerDisplay');
const signalCount = document.getElementById('signalCount');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const recordingDot = document.getElementById('recordingDot');
const recordingLabel = document.getElementById('recordingLabel');

// Stopped view elements
const openBtn = document.getElementById('openBtn');
const finalDuration = document.getElementById('finalDuration');

// Error display
const errorMsg = document.getElementById('error-msg');

// State
let statusInterval = null;
let isPaused = false;

// Format duration as MM:SS
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Show error message
function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    setTimeout(() => {
        errorMsg.style.display = 'none';
    }, 5000);
}

// Switch between views
function showView(view) {
    idleView.classList.add('hidden');
    recordingView.classList.add('hidden');
    stoppedView.classList.add('hidden');

    if (view === 'idle') {
        idleView.classList.remove('hidden');
    } else if (view === 'recording') {
        recordingView.classList.remove('hidden');
    } else if (view === 'stopped') {
        stoppedView.classList.remove('hidden');
    }
}

// Update recording UI
function updateRecordingUI(status) {
    timerDisplay.textContent = formatDuration(status.duration);
    signalCount.textContent = `${status.signalCount || 0} signals captured`;
}

// Get current status
async function getStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
        if (response) {
            if (response.isRecording) {
                showView('recording');
                updateRecordingUI(response);

                // Ensure we're polling
                if (!statusInterval) {
                    statusInterval = setInterval(getStatus, 200);
                }
            } else {
                // Not recording - check if we have a recording to open
                if (statusInterval) {
                    clearInterval(statusInterval);
                    statusInterval = null;
                }
            }
        }
    } catch (err) {
        console.error('Failed to get status:', err);
    }
}

// Request permissions and start recording
async function requestPermissionsAndStart() {
    const wantsMic = micToggle.checked;
    const wantsCamera = cameraToggle.checked;

    let hasMic = false;
    let hasCamera = false;

    // Request microphone permission if toggled
    if (wantsMic) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            hasMic = true;
            console.log('[Popup] Microphone permission granted');
        } catch (err) {
            console.log('[Popup] Microphone permission denied:', err.message);
            showError('Microphone access denied');
        }
    }

    // Request camera permission if toggled
    if (wantsCamera) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(t => t.stop());
            hasCamera = true;
            console.log('[Popup] Camera permission granted');
        } catch (err) {
            console.log('[Popup] Camera permission denied:', err.message);
            showError('Camera access denied');
        }
    }

    return { hasMic, hasCamera };
}

// Start recording
startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Starting...';

    try {
        // Request permissions directly in popup
        const permissions = await requestPermissionsAndStart();

        // Send to background with permission flags
        const response = await chrome.runtime.sendMessage({
            type: 'START_TAB_CAPTURE_DIRECT',
            options: permissions
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to start recording');
        }

        // Switch to recording view
        isPaused = false;
        showView('recording');

        // Start polling status
        statusInterval = setInterval(getStatus, 200);
        getStatus();
    } catch (err) {
        showError(err.message);
        startBtn.disabled = false;
        startBtn.textContent = 'Start Recording';
    }
});

// Pause/Resume recording
pauseBtn.addEventListener('click', async () => {
    try {
        if (isPaused) {
            // Resume
            await chrome.runtime.sendMessage({ type: 'RESUME_CAPTURE' });
            isPaused = false;
            pauseBtn.textContent = '⏸';
            pauseBtn.title = 'Pause';
            recordingDot.classList.remove('paused');
            recordingLabel.textContent = 'Recording';
        } else {
            // Pause
            await chrome.runtime.sendMessage({ type: 'PAUSE_CAPTURE' });
            isPaused = true;
            pauseBtn.textContent = '▶';
            pauseBtn.title = 'Resume';
            recordingDot.classList.add('paused');
            recordingLabel.textContent = 'Paused';
        }
    } catch (err) {
        showError(err.message);
    }
});

// Stop recording
stopBtn.addEventListener('click', async () => {
    stopBtn.disabled = true;
    stopBtn.textContent = 'Stopping...';

    try {
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
        }

        const result = await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });

        // Show final duration
        finalDuration.textContent = formatDuration(result.duration || 0);
        showView('stopped');

        // Auto-open editor after a brief moment
        setTimeout(async () => {
            try {
                await chrome.runtime.sendMessage({ type: 'OPEN_EDITOR' });
                window.close();
            } catch (err) {
                console.error('Failed to open editor:', err);
                // Still show the stopped view so user can manually click
            }
        }, 500);

    } catch (err) {
        showError(err.message);
        stopBtn.disabled = false;
        stopBtn.textContent = '⏹ Stop';
    }
});

// Open in Editor (manual fallback)
openBtn.addEventListener('click', async () => {
    openBtn.disabled = true;
    openBtn.textContent = 'Opening...';

    try {
        await chrome.runtime.sendMessage({ type: 'OPEN_EDITOR' });
        window.close();
    } catch (err) {
        showError(err.message);
        openBtn.disabled = false;
        openBtn.textContent = 'Open in Editor';
    }
});

// Initial status check
getStatus();

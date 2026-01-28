// Popup script for ScreenMu extension
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const openBtn = document.getElementById('openBtn');
const statusText = document.getElementById('status-text');
const durationRow = document.getElementById('duration-row');
const durationEl = document.getElementById('duration');
const signalsRow = document.getElementById('signals-row');
const signalsEl = document.getElementById('signals');

let statusInterval = null;

// Format duration as MM:SS
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Update UI based on current status
function updateUI(status) {
    if (status.isRecording) {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        openBtn.style.display = 'none';
        durationRow.style.display = 'flex';
        signalsRow.style.display = 'flex';

        statusText.innerHTML = '<span class="recording-indicator"><span class="recording-dot"></span>Recording</span>';
        durationEl.textContent = formatDuration(status.duration);
        signalsEl.textContent = status.signalCount || 0;
    } else {
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        durationRow.style.display = 'none';
        signalsRow.style.display = 'none';
        statusText.textContent = 'Ready';

        // Show open button if we have a recording in memory
        // For now, we only show it immediately after stop in the handler
    }
}

// Get current status
async function getStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
        if (response) {
            updateUI(response);

            // If recording, ensure we're polling
            if (response.isRecording && !statusInterval) {
                statusInterval = setInterval(getStatus, 500);
            }
        }
    } catch (err) {
        console.error('Failed to get status:', err);
    }
}

// Start recording
startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    statusText.textContent = 'Starting...';

    try {
        await chrome.runtime.sendMessage({ type: 'START_TAB_CAPTURE' });

        // Start polling status
        if (!statusInterval) {
            statusInterval = setInterval(getStatus, 500);
        }
        getStatus();
    } catch (err) {
        statusText.textContent = 'Error: ' + err.message;
        startBtn.disabled = false;
    }
});

// Stop recording
stopBtn.addEventListener('click', async () => {
    stopBtn.disabled = true;
    statusText.textContent = 'Stopping...';

    try {
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
        }

        const result = await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });

        statusText.textContent = 'Recording saved!';

        // Reset UI after a moment
        setTimeout(() => {
            updateUI({ isRecording: false });
            stopBtn.disabled = false;

            // Show open button
            startBtn.style.display = 'none';
            openBtn.style.display = 'block';
        }, 1000);
    } catch (err) {
        statusText.textContent = 'Error: ' + err.message;
        stopBtn.disabled = false;
    }
});

// Open in Editor
openBtn.addEventListener('click', async () => {
    openBtn.disabled = true;
    openBtn.textContent = 'Opening...';

    try {
        await chrome.runtime.sendMessage({ type: 'OPEN_EDITOR' });
        window.close(); // Close popup
    } catch (err) {
        statusText.textContent = 'Error: ' + err.message;
        openBtn.disabled = false;
        openBtn.textContent = 'Open in Editor';
    }
});

// Initial status check
getStatus();

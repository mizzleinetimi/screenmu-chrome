// Permissions page script - requests mic/camera access
// This runs in a tab context where permission dialogs can appear

const statusEl = document.getElementById('status');
const micStatus = document.getElementById('mic-status');
const camStatus = document.getElementById('cam-status');

async function requestPermissions() {
    let hasMic = false;
    let hasCamera = false;

    // Request microphone
    try {
        statusEl.textContent = 'Requesting microphone access...';
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        hasMic = true;
        micStream.getTracks().forEach(t => t.stop());
        micStatus.className = 'permission granted';
        micStatus.textContent = '🎤 ✓ Microphone';
        console.log('[Permissions] Microphone granted');
    } catch (err) {
        micStatus.className = 'permission denied';
        micStatus.textContent = '🎤 ✗ Microphone';
        console.log('[Permissions] Microphone denied:', err.message);
    }

    // Request camera
    try {
        statusEl.textContent = 'Requesting camera access...';
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        hasCamera = true;
        camStream.getTracks().forEach(t => t.stop());
        camStatus.className = 'permission granted';
        camStatus.textContent = '📷 ✓ Camera';
        console.log('[Permissions] Camera granted');
    } catch (err) {
        camStatus.className = 'permission denied';
        camStatus.textContent = '📷 ✗ Camera';
        console.log('[Permissions] Camera denied:', err.message);
    }

    // Update status
    if (hasMic && hasCamera) {
        statusEl.className = 'status granted';
        statusEl.textContent = 'All permissions granted! Starting recording...';
    } else if (hasMic || hasCamera) {
        statusEl.className = 'status granted';
        statusEl.textContent = 'Some permissions granted. Starting recording...';
    } else {
        statusEl.className = 'status denied';
        statusEl.textContent = 'Permissions denied. Recording screen only...';
    }

    // Send result back to background script
    setTimeout(async () => {
        try {
            await chrome.runtime.sendMessage({
                type: 'PERMISSIONS_RESULT',
                hasMic,
                hasCamera,
            });
        } catch (err) {
            console.error('[Permissions] Failed to send result:', err);
        }
    }, 1500);
}

// Start immediately
requestPermissions();

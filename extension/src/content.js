// Content script for Tab Mode signal capture
// See steering.md: Tab Mode captures mouse, clicks, focused element bounds, scroll
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

(function () {
    'use strict';

    // Signal buffer for batching
    const signalBuffer = [];
    const BATCH_INTERVAL = 100; // ms
    let isCapturing = false;
    let isPaused = false;
    let batchInterval = null;
    
    // Recording start time - used to normalize timestamps to start from 0
    let recordingStartTime = 0;

    // Normalize coordinates to 0-1 range, clamped to valid bounds
    function normalizeCoord(x, y) {
        return {
            x: Math.max(0, Math.min(1, x / window.innerWidth)),
            y: Math.max(0, Math.min(1, y / window.innerHeight)),
        };
    }

    // Get timestamp in microseconds, relative to recording start
    function getTimestamp() {
        return Math.floor((performance.now() - recordingStartTime) * 1000);
    }

    // Mouse move handler - high precision tracking
    let lastMoveTime = 0;
    let lastKnownPosition = { x: 0.5, y: 0.5 };
    let lastRawPosition = { x: 0, y: 0 };
    let velocityX = 0;
    let velocityY = 0;
    const MOVE_THROTTLE = 8; // ~120fps for smoother tracking
    const VELOCITY_SMOOTHING = 0.3; // Exponential smoothing factor for velocity

    function handleMouseMove(e) {
        if (!isCapturing || isPaused) return;

        const now = performance.now();
        const timeDelta = now - lastMoveTime;
        
        // Higher frequency capture for more accurate tracking
        if (timeDelta < MOVE_THROTTLE) return;
        lastMoveTime = now;

        const pos = normalizeCoord(e.clientX, e.clientY);
        
        // Calculate velocity for motion prediction
        if (timeDelta > 0 && timeDelta < 100) {
            const newVelX = (pos.x - lastKnownPosition.x) / (timeDelta / 1000);
            const newVelY = (pos.y - lastKnownPosition.y) / (timeDelta / 1000);
            // Exponential smoothing for velocity
            velocityX = velocityX * (1 - VELOCITY_SMOOTHING) + newVelX * VELOCITY_SMOOTHING;
            velocityY = velocityY * (1 - VELOCITY_SMOOTHING) + newVelY * VELOCITY_SMOOTHING;
        }
        
        lastKnownPosition = pos;
        lastRawPosition = { x: e.clientX, y: e.clientY };
        
        signalBuffer.push({
            type: 'MOUSE_MOVE',
            x: pos.x,
            y: pos.y,
            // Include velocity for smoother interpolation on playback
            velocityX: velocityX,
            velocityY: velocityY,
            timestamp: getTimestamp(),
        });
    }

    // Mouse leave handler - track when cursor leaves the window
    function handleMouseLeave(e) {
        if (!isCapturing || isPaused) return;
        
        // Record the last known position when cursor leaves
        // This helps prevent glitches when cursor re-enters
        signalBuffer.push({
            type: 'MOUSE_LEAVE',
            x: lastKnownPosition.x,
            y: lastKnownPosition.y,
            timestamp: getTimestamp(),
        });
    }

    // Mouse enter handler - track when cursor re-enters the window
    function handleMouseEnter(e) {
        if (!isCapturing || isPaused) return;
        
        const pos = normalizeCoord(e.clientX, e.clientY);
        lastKnownPosition = pos;
        signalBuffer.push({
            type: 'MOUSE_ENTER',
            x: pos.x,
            y: pos.y,
            timestamp: getTimestamp(),
        });
    }

    // Mouse click handler
    function handleMouseClick(e) {
        if (!isCapturing || isPaused) return;

        const pos = normalizeCoord(e.clientX, e.clientY);
        signalBuffer.push({
            type: 'MOUSE_CLICK',
            x: pos.x,
            y: pos.y,
            button: e.button,
            timestamp: getTimestamp(),
        });
    }

    // Focus change handler
    function handleFocusChange(e) {
        if (!isCapturing || isPaused) return;
        if (!e.target || !e.target.getBoundingClientRect) return;

        const rect = e.target.getBoundingClientRect();
        signalBuffer.push({
            type: 'FOCUS_CHANGE',
            bounds: {
                x: rect.x / window.innerWidth,
                y: rect.y / window.innerHeight,
                width: rect.width / window.innerWidth,
                height: rect.height / window.innerHeight,
            },
            timestamp: getTimestamp(),
        });
    }

    // Scroll handler
    function handleScroll(e) {
        if (!isCapturing || isPaused) return;

        signalBuffer.push({
            type: 'SCROLL',
            deltaY: e.deltaY,
            timestamp: getTimestamp(),
        });
    }

    // Flush buffer to background script
    function flushBuffer() {
        if (signalBuffer.length === 0) return;

        const signals = signalBuffer.splice(0, signalBuffer.length);
        chrome.runtime.sendMessage({
            type: 'SIGNAL_BATCH',
            signals,
        });
    }

    // Start capturing
    function startCapture() {
        if (isCapturing) return;
        isCapturing = true;
        isPaused = false;
        
        // Record the start time so all timestamps are relative to recording start
        recordingStartTime = performance.now();
        
        // Reset tracking state
        lastKnownPosition = { x: 0.5, y: 0.5 };
        lastRawPosition = { x: 0, y: 0 };
        velocityX = 0;
        velocityY = 0;

        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('click', handleMouseClick, { passive: true });
        document.addEventListener('focus', handleFocusChange, { capture: true, passive: true });
        document.addEventListener('wheel', handleScroll, { passive: true });
        document.addEventListener('mouseleave', handleMouseLeave, { passive: true });
        document.addEventListener('mouseenter', handleMouseEnter, { passive: true });

        // Start batch timer
        batchInterval = setInterval(flushBuffer, BATCH_INTERVAL);

        console.log('[ScreenMu] Tab Mode capture started at:', recordingStartTime);
    }

    // Pause capturing
    function pauseCapture() {
        isPaused = true;
        console.log('[ScreenMu] Tab Mode capture paused');
    }

    // Resume capturing
    function resumeCapture() {
        isPaused = false;
        console.log('[ScreenMu] Tab Mode capture resumed');
    }

    // Stop capturing
    function stopCapture() {
        if (!isCapturing) return;
        isCapturing = false;
        isPaused = false;

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('click', handleMouseClick);
        document.removeEventListener('focus', handleFocusChange, { capture: true });
        document.removeEventListener('wheel', handleScroll);
        document.removeEventListener('mouseleave', handleMouseLeave);
        document.removeEventListener('mouseenter', handleMouseEnter);

        // Clear batch timer
        if (batchInterval) {
            clearInterval(batchInterval);
            batchInterval = null;
        }

        // Flush remaining signals
        flushBuffer();

        console.log('[ScreenMu] Tab Mode capture stopped');
    }

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case 'PING':
                // Health check from background script
                sendResponse({ success: true, ready: true });
                break;
            case 'START_CAPTURE':
                startCapture();
                sendResponse({ success: true });
                break;
            case 'PAUSE_CAPTURE':
                pauseCapture();
                sendResponse({ success: true });
                break;
            case 'RESUME_CAPTURE':
                resumeCapture();
                sendResponse({ success: true });
                break;
            case 'STOP_CAPTURE':
                stopCapture();
                sendResponse({ success: true });
                break;

            case 'IMPORT_RECORDING_DATA':
                // Bridge data to the web app
                console.log('[ScreenMu Content] Received import data, posting to window');
                window.postMessage({
                    type: 'SCREENMU_EXTENSION_IMPORT',
                    data: message.recording
                }, '*');
                sendResponse({ success: true });
                break;

            default:
                break;
        }
        return true;
    });

    // Notify background that content script is ready
    chrome.runtime.sendMessage({ type: 'TAB_READY' });
})();

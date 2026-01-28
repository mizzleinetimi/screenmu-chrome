// Content script for Tab Mode signal capture
// See steering.md: Tab Mode captures mouse, clicks, focused element bounds, scroll
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

(function () {
    'use strict';

    // Signal buffer for batching
    const signalBuffer = [];
    const BATCH_INTERVAL = 100; // ms
    let isCapturing = false;

    // Normalize coordinates to 0-1 range
    function normalizeCoord(x, y) {
        return {
            x: x / window.innerWidth,
            y: y / window.innerHeight,
        };
    }

    // Get timestamp in microseconds
    function getTimestamp() {
        return Math.floor(performance.now() * 1000);
    }

    // Mouse move handler (throttled)
    let lastMoveTime = 0;
    const MOVE_THROTTLE = 16; // ~60fps

    function handleMouseMove(e) {
        if (!isCapturing) return;

        const now = performance.now();
        if (now - lastMoveTime < MOVE_THROTTLE) return;
        lastMoveTime = now;

        const pos = normalizeCoord(e.clientX, e.clientY);
        signalBuffer.push({
            type: 'MOUSE_MOVE',
            x: pos.x,
            y: pos.y,
            timestamp: getTimestamp(),
        });
    }

    // Mouse click handler
    function handleMouseClick(e) {
        if (!isCapturing) return;

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
        if (!isCapturing) return;
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
        if (!isCapturing) return;

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

        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('click', handleMouseClick, { passive: true });
        document.addEventListener('focus', handleFocusChange, { capture: true, passive: true });
        document.addEventListener('wheel', handleScroll, { passive: true });

        // Start batch timer
        setInterval(flushBuffer, BATCH_INTERVAL);

        console.log('[ScreenMu] Tab Mode capture started');
    }

    // Stop capturing
    function stopCapture() {
        if (!isCapturing) return;
        isCapturing = false;

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('click', handleMouseClick);
        document.removeEventListener('focus', handleFocusChange, { capture: true });
        document.removeEventListener('wheel', handleScroll);

        // Flush remaining signals
        flushBuffer();

        console.log('[ScreenMu] Tab Mode capture stopped');
    }

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case 'START_CAPTURE':
                startCapture();
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

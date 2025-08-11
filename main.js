// main.js
// This is the main entry point of the application. It sets up the core event listeners and
// imports the main Web Component `app-writer`, which encapsulates the entire application.

// main.js

import { log } from './js/utils/log.js';
import { config } from './config.js';
import './js/components/mainApp.js';
import './js/components/ui/toast.js';

document.addEventListener('DOMContentLoaded', () => {
    const logContainer = document.getElementById('logContainer');
    
    if (!config.DEBUG_MODE) {
        logContainer.style.display = 'none';
    } else {
        // ✅ FIXED: Add debug-active class to override mobile CSS
        logContainer.classList.add('debug-active');
        log('🐛 Debug mode active - logs visible on mobile!', 'success');
        log('Application initialized successfully', 'info');
        
        // Add debug info for wake lock
        if ('wakeLock' in navigator) {
            log('✅ Wake Lock API available', 'success');
        } else {
            log('❌ Wake Lock API not supported', 'warning');
        }
    }
});
// main.js
// This is the main entry point of the application. It sets up the core event listeners and
// imports the main Web Component `app-writer`, which encapsulates the entire application.

import { log } from './js/utils/log.js';
import { config } from './config.js';
import './js/components/writerApp.js';

document.addEventListener('DOMContentLoaded', () => {
    // Conditionally show the log container based on config
    const logContainer = document.getElementById('logContainer');
    if (!config.DEBUG_MODE) {
        logContainer.style.display = 'none';
    } else {
        log('Application initialized. Debug mode is active.', 'info');
    }
});
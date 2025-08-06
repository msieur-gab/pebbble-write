// utils/log.js
// This utility module provides a centralized logging function to manage debug output in a consistent format.

export function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logOutput = document.getElementById('logOutput');
    if (!logOutput) return;

    const logItem = document.createElement('div');
    let colorClass = '';
    let emoji = '📋';

    if (type === 'success') { colorClass = 'log-item success'; emoji = '✅'; } 
    else if (type === 'error') { colorClass = 'log-item error'; emoji = '❌'; } 
    else if (type === 'warning') { colorClass = 'log-item warning'; emoji = '⚠️'; }
    else { colorClass = 'log-item'; }

    logItem.className = colorClass;
    logItem.innerHTML = `<span class="timestamp">${timestamp}</span><span>${emoji} ${message}</span>`;
    logOutput.appendChild(logItem);
    logOutput.scrollTop = logOutput.scrollHeight;
}
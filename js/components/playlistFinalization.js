// js/components/playlistFinalization.js
// Refactored to use FinalizationService for business logic

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';
import { EncryptionService } from '../services/encryptionService.js';
import { FinalizationService } from '../services/finalizationService.js';
import { MessageDb } from '../services/messageDb.js';
import './writerResults.js';

class PlaylistFinalization extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Initialize services
        this.db = new MessageDb();
        this.encryptionService = new EncryptionService();
        this.finalizationService = null; // Will be set when storage service is available
        
        // UI state
        this.currentPlaylistData = null;
        this.currentTagSerial = null;
        
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; padding: 1rem; }
                .processing-container {
                    text-align: center;
                    max-width: 500px;
                    margin: 0 auto;
                }
                .process-status {
                    padding: 1.5rem;
                    border-radius: 0.5rem;
                    background-color: #f0f9ff;
                    color: #1e40af;
                    margin: 1rem 0;
                    font-size: 1.1rem;
                    border: 1px solid #bfdbfe;
                }
                .process-status.error {
                    background-color: #fef2f2;
                    color: #dc2626;
                    border-color: #fecaca;
                }
                .progress-info {
                    color: var(--secondary-color);
                    font-size: 0.9rem;
                    margin-top: 0.5rem;
                }
                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background-color: #e5e7eb;
                    border-radius: 4px;
                    margin: 1rem 0;
                    overflow: hidden;
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--primary-color), var(--button-hover));
                    border-radius: 4px;
                    transition: width 0.3s ease;
                    width: 0%;
                }
                .btn {
                    padding: 0.75rem 1.5rem;
                    font-weight: 700;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    border: none;
                    transition: background-color 0.3s ease;
                }
                .btn-secondary {
                    background-color: #e5e7eb;
                    color: #1f2937;
                }
                .btn-secondary:hover {
                    background-color: #d1d5db;
                }
                .hidden { display: none; }
                .estimation {
                    background: #fffbeb;
                    border: 1px solid #fcd34d;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin: 1rem 0;
                    font-size: 0.875rem;
                    color: #92400e;
                }
            </style>
            
            <div id="processing-view" class="processing-container">
                <h3>Finalizing Playlist</h3>
                
                <div id="estimation-section" class="estimation hidden">
                    <p id="estimation-text">Estimated time: 2-3 minutes</p>
                </div>
                
                <div id="process-status" class="process-status">
                    <p id="status-message">Preparing to finalize playlist...</p>
                    <div id="progress-info" class="progress-info hidden">
                        <span id="progress-text"></span>
                    </div>
                </div>
                
                <div id="progress-bar" class="progress-bar hidden">
                    <div id="progress-fill" class="progress-fill"></div>
                </div>
                
                <button id="cancel-btn" class="btn btn-secondary hidden">Cancel</button>
            </div>
            
            <writer-results id="results-view" class="hidden"></writer-results>
        `;
    }

    setupEventListeners() {
        // Listen for serial number from modal
        eventBus.subscribe('serial-received', (serial) => {
            this.handleSerialReceived(serial);
        });

        // Cancel button
        this.shadowRoot.querySelector('#cancel-btn').addEventListener('click', () => {
            this.handleCancel();
        });

        // From results view
        eventBus.subscribe('navigate-to-home', () => {
            eventBus.publish('back-to-home');
        });
    }

    /**
     * Start finalization process
     * @param {Object} playlistData - Playlist data to finalize
     * @param {Object} storageService - Storage service instance
     */
    async startFinalization(playlistData, storageService) {
        this.currentPlaylistData = playlistData;
        
        // Initialize finalization service with storage service
        this.finalizationService = new FinalizationService(
            this.encryptionService,
            storageService,
            this.db
        );

        // Validate inputs
        if (!playlistData || !playlistData.clips || playlistData.clips.length === 0) {
            this.showError('Cannot finalize an empty playlist. Please add some audio clips.');
            return;
        }

        if (!storageService) {
            this.showError('Storage service not available. Please check your API credentials.');
            return;
        }

        // Show estimation
        this.showEstimation(playlistData.clips.length);

        // Update status and request serial number
        this.updateStatus(`Ready to finalize "${playlistData.name}"`);
        eventBus.publish('show-serial-modal');
    }

    async handleSerialReceived(serial) {
        this.currentTagSerial = serial;
        eventBus.publish('hide-serial-modal');
        
        // Start the finalization process
        await this.runFinalization();
    }

    async runFinalization() {
        if (!this.finalizationService || !this.currentPlaylistData || !this.currentTagSerial) {
            this.showError('Finalization not properly initialized');
            return;
        }

        // Show progress elements
        this.showProgressElements();

        try {
            // Start finalization with progress callback
            const result = await this.finalizationService.finalizePlaylist(
                this.currentPlaylistData,
                this.currentTagSerial,
                (progress) => this.handleProgress(progress)
            );

            // Show results
            this.showResults(result);

        } catch (error) {
            this.showError(error.message || 'An error occurred during finalization.');
        }
    }

    handleProgress(progressData) {
        const { stage, message, percentage, current, total, error } = progressData;

        if (error) {
            this.showError(message);
            return;
        }

        // Update status message
        this.updateStatus(message);

        // Update detailed progress if available
        if (current !== undefined && total !== undefined) {
            const progressText = this.shadowRoot.querySelector('#progress-text');
            progressText.textContent = `Processing ${current} of ${total}`;
        }

        // Update progress bar
        if (percentage !== undefined) {
            this.updateProgressBar(percentage);
        }

        // Handle completion
        if (stage === 'completed') {
            this.hideProgressElements();
        }
    }

    showEstimation(clipCount) {
        const estimation = this.finalizationService.estimateFinalizationTime(clipCount);
        const estimationSection = this.shadowRoot.querySelector('#estimation-section');
        const estimationText = this.shadowRoot.querySelector('#estimation-text');
        
        estimationText.textContent = `Estimated time: ${estimation.estimatedMinutes} minute${estimation.estimatedMinutes === 1 ? '' : 's'} (${clipCount} clips to process)`;
        estimationSection.classList.remove('hidden');
    }

    showProgressElements() {
        const progressBar = this.shadowRoot.querySelector('#progress-bar');
        const progressInfo = this.shadowRoot.querySelector('#progress-info');
        const cancelBtn = this.shadowRoot.querySelector('#cancel-btn');

        progressBar.classList.remove('hidden');
        progressInfo.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
    }

    hideProgressElements() {
        const progressBar = this.shadowRoot.querySelector('#progress-bar');
        const progressInfo = this.shadowRoot.querySelector('#progress-info');
        const cancelBtn = this.shadowRoot.querySelector('#cancel-btn');

        progressBar.classList.add('hidden');
        progressInfo.classList.add('hidden');
        cancelBtn.classList.add('hidden');
    }

    updateProgressBar(percentage) {
        const progressFill = this.shadowRoot.querySelector('#progress-fill');
        progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }

    showResults(result) {
        const processingView = this.shadowRoot.querySelector('#processing-view');
        const resultsView = this.shadowRoot.querySelector('#results-view');
        
        processingView.classList.add('hidden');
        resultsView.classList.remove('hidden');
        
        // Configure results component
        resultsView.setResults({
            url: result.url,
            serial: this.currentTagSerial,
            playlistName: result.playlistName,
            stats: {
                processedClips: result.processedClips,
                totalClips: result.totalClips
            }
        });

        log(`Playlist "${result.playlistName}" finalized successfully`, 'success');
    }

    updateStatus(message) {
        const statusEl = this.shadowRoot.querySelector('#status-message');
        statusEl.textContent = message;
        
        // Reset error state
        const statusBox = this.shadowRoot.querySelector('#process-status');
        statusBox.className = 'process-status';
    }

    showError(message) {
        const statusEl = this.shadowRoot.querySelector('#process-status');
        statusEl.className = 'process-status error';
        statusEl.querySelector('#status-message').textContent = message;
        
        const progressInfo = this.shadowRoot.querySelector('#progress-info');
        const estimationSection = this.shadowRoot.querySelector('#estimation-section');
        const progressBar = this.shadowRoot.querySelector('#progress-bar');
        
        progressInfo.classList.add('hidden');
        estimationSection.classList.add('hidden');
        progressBar.classList.add('hidden');
        
        // Show cancel/back button
        const cancelBtn = this.shadowRoot.querySelector('#cancel-btn');
        cancelBtn.classList.remove('hidden');
        cancelBtn.textContent = 'Back to Playlist';

        log(`Finalization error: ${message}`, 'error');
    }

    handleCancel() {
        // Try to cancel finalization if possible
        if (this.finalizationService && this.finalizationService.isCurrentlyProcessing()) {
            const cancelResult = this.finalizationService.cancelFinalization();
            if (!cancelResult.success) {
                log(cancelResult.message, 'warning');
                return; // Don't navigate away if cancellation failed
            }
        }

        eventBus.publish('back-to-home');
    }

    /**
     * Reset component state
     */
    reset() {
        const processingView = this.shadowRoot.querySelector('#processing-view');
        const resultsView = this.shadowRoot.querySelector('#results-view');
        const statusEl = this.shadowRoot.querySelector('#process-status');
        const progressBar = this.shadowRoot.querySelector('#progress-bar');
        const progressInfo = this.shadowRoot.querySelector('#progress-info');
        const cancelBtn = this.shadowRoot.querySelector('#cancel-btn');
        const estimationSection = this.shadowRoot.querySelector('#estimation-section');
        
        processingView.classList.remove('hidden');
        resultsView.classList.add('hidden');
        statusEl.className = 'process-status';
        progressBar.classList.add('hidden');
        progressInfo.classList.add('hidden');
        cancelBtn.classList.add('hidden');
        estimationSection.classList.add('hidden');
        
        // Reset progress bar
        this.updateProgressBar(0);
        
        // Reset state
        this.currentPlaylistData = null;
        this.currentTagSerial = null;
        
        // Reset service if available
        if (this.finalizationService) {
            this.finalizationService.reset();
        }

        log('Playlist finalization component reset', 'info');
    }

    /**
     * Get current processing status
     * @returns {Object|null} Current status or null if not processing
     */
    getCurrentStatus() {
        return this.finalizationService?.getCurrentStatus() || null;
    }
}

customElements.define('playlist-finalization', PlaylistFinalization);
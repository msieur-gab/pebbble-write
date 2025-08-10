// js/components/audioCreator.js
// Improved UX - keep user in creation flow

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';
import { MessageDb } from '../services/messageDb.js';
import './audioRecorder.js';

class AudioCreator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.db = new MessageDb();
        this.savedClipsCount = 0;
        
        this.render();
        this.setupEventListeners();
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; padding: 1rem; }
                .audio-creator {
                    max-width: 600px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .stats-section {
                    background: #f0f9ff;
                    border: 1px solid #e0f2fe;
                    border-radius: 0.75rem;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                    text-align: center;
                }
                .stats-text {
                    color: #0369a1;
                    font-weight: 500;
                    margin: 0;
                }
                .btn { 
                    padding: 0.75rem 1.5rem; 
                    font-weight: 700; 
                    border-radius: 0.5rem; 
                    cursor: pointer; 
                    border: none; 
                    transition: background-color 0.3s ease; 
                    margin: 0 0.5rem;
                }
                .btn-secondary { background-color: #e5e7eb; color: #1f2937; }
                .btn-secondary:hover { background-color: #d1d5db; }
                .btn-primary { background-color: var(--primary-color); color: #ffffff; }
                .btn-primary:hover { background-color: var(--button-hover); }
                .actions-section {
                    text-align: center;
                    margin-top: 2rem;
                    padding-top: 2rem;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .success-message {
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin-bottom: 1rem;
                    text-align: center;
                    color: #166534;
                    display: none;
                }
                .success-message.show {
                    display: block;
                    animation: slideIn 0.3s ease-out;
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
            
            <div class="audio-creator">
                <div class="header">
                    <h3>Create Audio Clips</h3>
                    <p>Record voice messages or upload music files to your audio library.</p>
                </div>
                
                <div class="stats-section" id="stats-section">
                    <p class="stats-text" id="stats-text">Ready to create your first audio clip</p>
                </div>
                
                <div id="success-message" class="success-message">
                    <p id="success-text">✅ Audio clip saved successfully!</p>
                </div>
                
                <audio-recorder id="audio-recorder"></audio-recorder>
                
                <div class="actions-section">
                    <button id="view-library-btn" class="btn btn-primary">View Audio Library</button>
                    <button id="create-playlist-btn" class="btn btn-primary">Create Playlist</button>
                    <button id="back-to-home-btn" class="btn btn-secondary">Back to Home</button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Listen for saved audio clip from the recorder
        eventBus.subscribe('audio-saved', (audioData) => {
            this.handleAudioSaved(audioData);
        });
        
        // Navigation buttons
        this.shadowRoot.querySelector('#back-to-home-btn').addEventListener('click', () => {
            this.resetAndNavigate('back-to-home');
        });

        this.shadowRoot.querySelector('#view-library-btn').addEventListener('click', () => {
            this.resetAndNavigate('open-audio-library');
        });

        this.shadowRoot.querySelector('#create-playlist-btn').addEventListener('click', () => {
            this.resetAndNavigate('new-playlist-requested');
        });
    }

    handleAudioSaved(audioData) {
        // Just handle UI updates - saving is handled elsewhere
        this.savedClipsCount++;
        this.updateStats();
        
        // Show success message  
        this.showSuccessMessage(audioData.title);
        
        // Reset the recorder for next clip
        this.resetRecorderForNext();
        
        log(`Audio clip "${audioData.title}" ready for use.`, 'success');
    }

    updateStats() {
        const statsText = this.shadowRoot.querySelector('#stats-text');
        
        if (this.savedClipsCount === 0) {
            statsText.textContent = 'Ready to create your first audio clip';
        } else if (this.savedClipsCount === 1) {
            statsText.textContent = '🎉 1 audio clip created! Ready for the next one?';
        } else {
            statsText.textContent = `🎉 ${this.savedClipsCount} audio clips created! Keep going!`;
        }
    }

    showSuccessMessage(clipTitle) {
        const successMessage = this.shadowRoot.querySelector('#success-message');
        const successText = this.shadowRoot.querySelector('#success-text');
        
        successText.textContent = `✅ "${clipTitle}" saved to your audio library!`;
        successMessage.classList.add('show');
        
        // Hide success message after 3 seconds
        setTimeout(() => {
            successMessage.classList.remove('show');
        }, 3000);
    }

    resetRecorderForNext() {
        const audioRecorder = this.shadowRoot.querySelector('#audio-recorder');
        
        // Reset the recorder component
        if (audioRecorder && audioRecorder.resetRecorder) {
            audioRecorder.resetRecorder();
        }
        
        // Suggest a new title based on count
        if (audioRecorder && audioRecorder.setTitle) {
            const suggestedTitle = `Audio Clip ${this.savedClipsCount + 1}`;
            audioRecorder.setTitle(suggestedTitle);
        }
    }

    resetAndNavigate(eventName) {
        // Stop any audio before navigating
        const audioRecorder = this.shadowRoot.querySelector('#audio-recorder');
        if (audioRecorder && audioRecorder.resetRecorder) {
            audioRecorder.resetRecorder();
        }
        
        // Reset component state
        this.savedClipsCount = 0;
        this.updateStats();
        
        // Navigate
        eventBus.publish(eventName);
    }

    // Public method to reset the component when navigating to it
    reset() {
        this.savedClipsCount = 0;
        this.updateStats();
        
        const successMessage = this.shadowRoot.querySelector('#success-message');
        successMessage.classList.remove('show');
        
        const audioRecorder = this.shadowRoot.querySelector('#audio-recorder');
        if (audioRecorder && audioRecorder.resetRecorder) {
            audioRecorder.resetRecorder();
        }
    }
}

customElements.define('audio-creator', AudioCreator);
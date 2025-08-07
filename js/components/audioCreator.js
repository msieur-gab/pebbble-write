// js/components/audioCreator.js

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';
import './audioRecorder.js';

class AudioCreator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
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
                .btn { 
                    padding: 0.75rem 1.5rem; 
                    font-weight: 700; 
                    border-radius: 0.5rem; 
                    cursor: pointer; 
                    border: none; 
                    transition: background-color 0.3s ease; 
                }
                .btn-secondary { background-color: #e5e7eb; color: #1f2937; }
                .btn-secondary:hover { background-color: #d1d5db; }
                .back-section {
                    text-align: center;
                    margin-top: 2rem;
                    padding-top: 2rem;
                    border-top: 1px solid #e5e7eb;
                }
            </style>
            
            <div class="audio-creator">
                <div class="header">
                    <h3>Create New Audio Clip</h3>
                    <p>Record a voice message or upload a music file to your audio library.</p>
                </div>
                
                <audio-recorder id="audio-recorder"></audio-recorder>
                
                <div class="back-section">
                    <button id="back-to-home-btn" class="btn btn-secondary">Back to Home Screen</button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Listen for saved audio clip from the shared component
        eventBus.subscribe('audio-clip-saved', (savedClip) => {
            this.handleAudioSaved(savedClip);
        });
        
        // Back button
        this.shadowRoot.querySelector('#back-to-home-btn').addEventListener('click', () => {
            eventBus.publish('back-to-home');
        });
    }

    handleAudioSaved(savedClip) {
        // Audio is already saved to database by audioRecorder
        // Just handle the post-save actions
        log(`Audio clip "${savedClip.title}" saved to library.`, 'success');
        
        // Automatically go back to home after saving
        setTimeout(() => {
            eventBus.publish('back-to-home');
        }, 1500);
    }
}

customElements.define('audio-creator', AudioCreator);
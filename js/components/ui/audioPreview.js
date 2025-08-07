// js/components/ui/audioPreview.js
// Reusable audio preview component with play button, title, and duration

import { eventBus } from '../../services/eventBus.js';

class AudioPreview extends HTMLElement {
    static get observedAttributes() {
        return ['clip-id', 'title', 'duration', 'layout'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.audioBlob = null;
        this.render();
        this.setupEventListeners();
    }

    attributeChangedCallback() {
        this.render();
    }

    render() {
        const clipId = this.getAttribute('clip-id') || '';
        const title = this.getAttribute('title') || 'Audio Preview';
        const duration = this.getAttribute('duration') || '0:00';
        const layout = this.getAttribute('layout') || 'full'; // 'full', 'compact', 'minimal', 'playlist', 'library'

        let template = '';

        if (layout === 'library') {
            template = `
                <style>
                    .audio-preview {
                        background-color: #ffffff; 
                        padding: 0.75rem; 
                        border-radius: 0.5rem; 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); 
                        margin-bottom: 0.5rem;
                        border: 1px solid #e5e7eb;
                    }
                    .clip-info-section {
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                        flex: 1;
                    }
                    .play-btn {
                        width: 2.5rem;
                        height: 2.5rem;
                        border-radius: 50%;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.875rem;
                        transition: all 0.2s ease;
                    }
                    .play-btn:hover {
                        background: var(--button-hover);
                        transform: scale(1.05);
                    }
                    .play-btn.playing {
                        background: var(--accent-color);
                    }
                    .clip-details {
                        flex: 1;
                        min-width: 0;
                    }
                    .clip-title {
                        font-weight: 600;
                        margin: 0 0 0.25rem 0;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .clip-duration {
                        font-size: 0.75rem;
                        color: var(--secondary-color);
                        margin: 0;
                    }
                    .delete-btn {
                        padding: 0.75rem 1.5rem;
                        font-weight: 700;
                        border-radius: 0.5rem;
                        cursor: pointer;
                        border: none;
                        background-color: var(--accent-color);
                        color: white;
                        transition: background-color 0.3s ease;
                    }
                    .delete-btn:hover {
                        background-color: #dc2626;
                    }
                </style>
                <div class="audio-preview">
                    <div class="clip-info-section">
                        <button class="play-btn" id="play-btn">▶</button>
                        <div class="clip-details">
                            <p class="clip-title">${title}</p>
                            <p class="clip-duration">${duration}</p>
                        </div>
                    </div>
                    <button class="delete-btn" id="delete-btn">Delete</button>
                </div>
            `;
        } else if (layout === 'playlist') {
            template = `
                <style>
                    .audio-preview {
                        background-color: #ffffff; 
                        padding: 0.75rem; 
                        border-radius: 0.5rem; 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); 
                        margin-bottom: 0.5rem;
                        border: 1px solid #e5e7eb;
                    }
                    .clip-title {
                        font-weight: 600;
                        margin-right: 1rem;
                    }
                    .clip-controls {
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                    }
                    .play-btn {
                        width: 2.5rem;
                        height: 2.5rem;
                        border-radius: 50%;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.875rem;
                        transition: all 0.2s ease;
                    }
                    .play-btn:hover {
                        background: var(--button-hover);
                        transform: scale(1.05);
                    }
                    .play-btn.playing {
                        background: var(--accent-color);
                    }
                    .audio-info {
                        font-size: 0.75rem;
                        color: var(--secondary-color);
                        min-width: 60px;
                        text-align: center;
                    }
                    .remove-btn {
                        padding: 0.75rem 1.5rem;
                        font-weight: 700;
                        border-radius: 0.5rem;
                        cursor: pointer;
                        border: none;
                        background-color: #e5e7eb;
                        color: #1f2937;
                        transition: background-color 0.3s ease;
                    }
                    .remove-btn:hover {
                        background-color: #d1d5db;
                    }
                </style>
                <div class="audio-preview">
                    <span class="clip-title"><strong>${title}</strong></span>
                    <div class="clip-controls">
                        <button class="play-btn" id="play-btn">▶</button>
                        <div class="audio-info">${duration}</div>
                        <button class="remove-btn" id="remove-btn">Remove</button>
                    </div>
                </div>
            `;
        } else if (layout === 'compact') {
            template = `
                <style>
                    .audio-preview {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        padding: 0.5rem;
                        background: #f9fafb;
                        border: 1px solid #e5e7eb;
                        border-radius: 0.375rem;
                    }
                    .play-btn {
                        width: 2rem;
                        height: 2rem;
                        border-radius: 50%;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.75rem;
                        transition: all 0.2s ease;
                    }
                    .play-btn:hover {
                        background: var(--button-hover);
                        transform: scale(1.05);
                    }
                    .audio-info {
                        flex: 1;
                        min-width: 0;
                    }
                    .audio-title {
                        font-size: 0.875rem;
                        font-weight: 500;
                        margin: 0;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .audio-duration {
                        font-size: 0.75rem;
                        color: var(--secondary-color);
                        margin: 0;
                    }
                </style>
                <div class="audio-preview">
                    <button class="play-btn" id="play-btn">▶</button>
                    <div class="audio-info">
                        <p class="audio-title">${title}</p>
                        <p class="audio-duration">${duration}</p>
                    </div>
                </div>
            `;
        } else if (layout === 'minimal') {
            template = `
                <style>
                    .audio-preview {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    }
                    .play-btn {
                        width: 2.5rem;
                        height: 2.5rem;
                        border-radius: 50%;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.875rem;
                        transition: all 0.2s ease;
                    }
                    .play-btn:hover {
                        background: var(--button-hover);
                        transform: scale(1.05);
                    }
                    .audio-duration {
                        font-size: 0.75rem;
                        color: var(--secondary-color);
                        min-width: 60px;
                        text-align: center;
                    }
                </style>
                <div class="audio-preview">
                    <button class="play-btn" id="play-btn">▶</button>
                    <span class="audio-duration">${duration}</span>
                </div>
            `;
        } else {
            // Full layout (default)
            template = `
                <style>
                    .audio-preview {
                        background: #f3f4f6;
                        border: 1px solid #d1d5db;
                        border-radius: 0.5rem;
                        padding: 1rem;
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                    }
                    .play-btn {
                        width: 3rem;
                        height: 3rem;
                        border-radius: 50%;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1.2rem;
                        transition: all 0.2s ease;
                    }
                    .play-btn:hover {
                        background: var(--button-hover);
                        transform: scale(1.05);
                    }
                    .play-btn.playing {
                        background: var(--accent-color);
                    }
                    .audio-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        gap: 0.25rem;
                    }
                    .audio-title {
                        font-weight: 600;
                        color: #374151;
                        margin: 0;
                    }
                    .audio-duration {
                        color: var(--secondary-color);
                        font-size: 0.875rem;
                        margin: 0;
                    }
                </style>
                <div class="audio-preview">
                    <button class="play-btn" id="play-btn">▶</button>
                    <div class="audio-info">
                        <p class="audio-title">${title}</p>
                        <p class="audio-duration">Duration: ${duration}</p>
                    </div>
                </div>
            `;
        }

        this.shadowRoot.innerHTML = template;
    }

    setupEventListeners() {
        this.shadowRoot.addEventListener('click', (e) => {
            if (e.target.id === 'play-btn') {
                this.togglePlayback();
            } else if (e.target.id === 'remove-btn') {
                this.handleRemove();
            } else if (e.target.id === 'delete-btn') {
                this.handleDelete();
            }
        });

        // Listen for audio service events to sync button states
        eventBus.subscribe('audio-started', (data) => {
            const myClipId = this.getAttribute('clip-id');
            const playBtn = this.shadowRoot.querySelector('#play-btn');
            
            if (playBtn) {
                if (String(data.id) === String(myClipId)) {
                    // This component's audio started playing
                    playBtn.textContent = '⏸';
                    playBtn.classList.add('playing');
                } else {
                    // Another component's audio started playing - reset this one
                    playBtn.textContent = '▶';
                    playBtn.classList.remove('playing');
                }
            }
        });

        eventBus.subscribe('audio-paused', (data) => {
            const myClipId = this.getAttribute('clip-id');
            const playBtn = this.shadowRoot.querySelector('#play-btn');
            
            if (String(data.id) === String(myClipId) && playBtn) {
                playBtn.textContent = '▶';
                playBtn.classList.remove('playing');
            }
        });

        eventBus.subscribe('audio-ended', (data) => {
            const myClipId = this.getAttribute('clip-id');
            const playBtn = this.shadowRoot.querySelector('#play-btn');
            
            if (String(data.id) === String(myClipId) && playBtn) {
                playBtn.textContent = '▶';
                playBtn.classList.remove('playing');
            }
        });
    }

    togglePlayback() {
        if (!this.audioBlob) {
            console.warn('No audio blob set for audio preview');
            return;
        }

        const playBtn = this.shadowRoot.querySelector('#play-btn');
        const clipId = this.getAttribute('clip-id');

        // Update this button immediately for responsive feel
        if (playBtn.textContent === '▶') {
            playBtn.textContent = '⏸';
            playBtn.classList.add('playing');
        } else {
            playBtn.textContent = '▶';
            playBtn.classList.remove('playing');
        }

        // Emit play event - events will handle cross-component synchronization
        eventBus.publish('play-audio', {
            id: clipId,
            audioBlob: this.audioBlob
        });
    }

    handleRemove() {
        const clipId = this.getAttribute('clip-id');
        
        // Emit remove event (for playlist - removes from playlist but keeps file)
        this.dispatchEvent(new CustomEvent('clip-remove', {
            detail: { clipId: clipId },
            bubbles: true
        }));
    }

    handleDelete() {
        const clipId = this.getAttribute('clip-id');
        
        // Emit delete event (for library - permanently deletes file)
        this.dispatchEvent(new CustomEvent('clip-delete', {
            detail: { clipId: clipId },
            bubbles: true
        }));
    }

    // Public method to set audio data
    setAudioBlob(audioBlob) {
        this.audioBlob = audioBlob;
    }

    // Public method to reset play button
    resetPlayButton() {
        const playBtn = this.shadowRoot.querySelector('#play-btn');
        if (playBtn) {
            playBtn.textContent = '▶';
            playBtn.classList.remove('playing');
        }
    }

    // Method to format duration
    static formatDuration(seconds) {
        if (isNaN(seconds) || seconds === Infinity || !seconds) {
            return '0:00';
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    }
}

customElements.define('audio-preview', AudioPreview);
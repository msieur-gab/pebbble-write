// js/components/playlistCreator.js

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';
import { MessageDb } from '../services/messageDb.js';
import './audioRecorder.js';

class PlaylistCreator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.db = new MessageDb();
        this.currentPlaylistId = null;
        this.currentPlaylistClips = [];
        this.allAvailableClips = [];

        this.render();
        this.setupEventListeners();
    }
    
    async setPlaylistData(playlist) {
        this.currentPlaylistId = playlist?.id || null;
        this.shadowRoot.querySelector('#playlistTitle').value = playlist?.name || '';
        this.shadowRoot.querySelector('#playlistDescription').value = playlist?.description || '';
        
        if (playlist) {
            this.currentPlaylistClips = await this.db.getAudioClipsForPlaylist(playlist.id);
        } else {
            this.currentPlaylistClips = [];
        }

        this.allAvailableClips = await this.db.getAllAudioClips();
        this.renderClips();
        this.renderAvailableClips();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; padding: 1rem; }
                .playlist-creator { max-width: 800px; margin: 0 auto; }
                .section { margin-bottom: 2rem; padding: 1.5rem; background: #f9fafb; border-radius: 0.75rem; }
                .text-center { text-align: center; }
                .space-y-4 > * + * { margin-top: 1rem; }
                .btn { padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 0.5rem; cursor: pointer; border: none; transition: background-color 0.3s ease; }
                .btn-primary { background-color: var(--primary-color); color: #ffffff; }
                .btn-secondary { background-color: #e5e7eb; color: #1f2937; }
                .btn:hover.btn-primary { background-color: var(--button-hover); }
                .btn:hover.btn-secondary { background-color: #d1d5db; }
                .form-input { width: 100%; padding: 0.75rem; border: 2px solid #d1d5db; border-radius: 0.5rem; transition: border-color 0.3s ease; }
                .form-input:focus { outline: none; border-color: var(--primary-color); }
                
                .playlist-clip-item { 
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
                .clip-controls {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .clip-controls audio { width: 150px; }
                
                .available-clips-container {
                    display: flex;
                    gap: 1rem;
                    overflow-x: auto;
                    padding-bottom: 1rem;
                    margin-top: 1rem;
                }
                .clip-card {
                    background-color: #ffffff;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    min-width: 150px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 2px solid #e5e7eb;
                    flex-shrink: 0;
                }
                .clip-card:hover {
                    border-color: var(--primary-color);
                    transform: translateY(-2px);
                }
                
                .actions-section {
                    display: flex;
                    gap: 1rem;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                }
                
                .empty-state {
                    text-align: center;
                    color: var(--secondary-color);
                    font-style: italic;
                    padding: 2rem;
                }
            </style>
            
            <div class="playlist-creator">
                <!-- Playlist Info Section -->
                <div class="section">
                    <h2>Playlist Details</h2>
                    <div class="space-y-4">
                        <input type="text" id="playlistTitle" placeholder="Playlist Title" class="form-input">
                        <textarea id="playlistDescription" placeholder="Playlist Description" class="form-input" rows="3"></textarea>
                    </div>
                </div>

                <!-- Add New Audio Section -->
                <div class="section">
                    <h3>Add New Audio</h3>
                    <audio-recorder id="audio-recorder"></audio-recorder>
                </div>
                
                <!-- Current Clips Section -->
                <div class="section">
                    <h3>Playlist Clips (${this.currentPlaylistClips?.length || 0})</h3>
                    <div id="clips-container"></div>
                </div>

                <!-- Available Clips Section -->
                <div class="section">
                    <h3>Add from Library</h3>
                    <p>Click any clip to add it to your playlist:</p>
                    <div id="available-clips-container" class="available-clips-container"></div>
                </div>

                <!-- Actions Section -->
                <div class="actions-section">
                    <button id="backToHomeBtn" class="btn btn-secondary">Back to Home</button>
                    <div style="display: flex; gap: 1rem;">
                        <button id="savePlaylistBtn" class="btn btn-primary">Save Playlist</button>
                        <button id="finalizePlaylistBtn" class="btn btn-primary">Finalize Playlist</button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Playlist actions
        this.shadowRoot.querySelector('#savePlaylistBtn').addEventListener('click', () => {
            const playlistTitle = this.shadowRoot.querySelector('#playlistTitle').value.trim();
            const playlistDescription = this.shadowRoot.querySelector('#playlistDescription').value.trim();
            
            if (!playlistTitle) {
                log('Please enter a playlist title.', 'warning');
                return;
            }
            
            const audioClipIds = this.currentPlaylistClips.map(clip => clip.id);
            eventBus.publish('save-playlist-requested', { 
                id: this.currentPlaylistId, 
                name: playlistTitle, 
                description: playlistDescription,
                audioClipIds: audioClipIds
            });
        });
        
        this.shadowRoot.querySelector('#backToHomeBtn').addEventListener('click', () => {
            eventBus.publish('back-to-home');
        });
        
        this.shadowRoot.querySelector('#finalizePlaylistBtn').addEventListener('click', () => {
            const playlistTitle = this.shadowRoot.querySelector('#playlistTitle').value.trim();
            if (!playlistTitle) {
                log('Please enter a playlist title before finalizing.', 'warning');
                return;
            }
            if (this.currentPlaylistClips.length === 0) {
                log('Please add some audio clips before finalizing.', 'warning');
                return;
            }
            eventBus.publish('finalize-playlist-requested');
        });
        
        // Clip management
        const clipsContainer = this.shadowRoot.querySelector('#clips-container');
        clipsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-clip-btn')) {
                const clipId = parseInt(e.target.dataset.id);
                this.removeClipFromPlaylist(clipId);
            }
        });
        
        this.shadowRoot.querySelector('#available-clips-container').addEventListener('click', (e) => {
            if (e.target.closest('.clip-card')) {
                const clipId = parseInt(e.target.closest('.clip-card').dataset.id);
                this.addClipToPlaylist(clipId);
            }
        });
        
        // Listen for new audio from shared recorder
        eventBus.subscribe('audio-recorded', (audioData) => {
            this.handleNewAudio(audioData);
        });
    }
    
    async handleNewAudio(audioData) {
        try {
            const { title, audioBlob, duration } = audioData;
            
            // Save to database
            const clipId = await this.db.saveAudioClip(title, audioBlob, duration);
            const savedClip = { 
                id: clipId, 
                title: title, 
                audioBlob: audioBlob, 
                duration: duration 
            };
            
            // Add to current playlist and available clips
            this.currentPlaylistClips.push(savedClip);
            this.allAvailableClips.push(savedClip);
            
            log(`Audio "${title}" added to playlist.`, 'success');
            
            // Refresh UI
            this.renderClips();
            this.renderAvailableClips();
            
        } catch (err) { 
            log(`Failed to save audio: ${err.message}`, 'error'); 
        }
    }
    
    async addClipToPlaylist(clipId) {
        const clipToAdd = await this.db.getAudioClip(clipId);
        if (clipToAdd && !this.currentPlaylistClips.some(clip => clip.id === clipId)) {
            this.currentPlaylistClips.push(clipToAdd);
            this.renderClips();
            this.renderAvailableClips();
            log(`Clip "${clipToAdd.title}" added to playlist.`, 'info');
        }
    }
    
    removeClipFromPlaylist(id) {
        const clipIndex = this.currentPlaylistClips.findIndex(clip => clip.id === id);
        if (clipIndex > -1) {
            const removedClip = this.currentPlaylistClips[clipIndex];
            this.currentPlaylistClips.splice(clipIndex, 1);
            this.renderClips();
            this.renderAvailableClips();
            log(`Clip "${removedClip.title}" removed from playlist.`, 'info');
        }
    }

    async renderAvailableClips() {
        const container = this.shadowRoot.querySelector('#available-clips-container');
        container.innerHTML = '';

        const availableClips = this.allAvailableClips.filter(clip => 
            !this.currentPlaylistClips.some(c => c.id === clip.id)
        );

        if (availableClips.length === 0) {
            container.innerHTML = '<div class="empty-state">No available clips. Create some audio clips first!</div>';
            return;
        }

        availableClips.forEach(clip => {
            const card = document.createElement('div');
            card.className = 'clip-card';
            card.dataset.id = clip.id;
            card.innerHTML = `
                <h4>${clip.title}</h4>
                <p>${this.formatDuration(clip.duration)}</p>
                <small>Click to add</small>
            `;
            container.appendChild(card);
        });
    }

    formatDuration(seconds) {
        if (isNaN(seconds) || seconds === Infinity || !seconds) {
            return 'N/A';
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    async renderClips() {
        const container = this.shadowRoot.querySelector('#clips-container');
        container.innerHTML = '';

        if (this.currentPlaylistClips.length === 0) {
            container.innerHTML = '<div class="empty-state">No clips in playlist yet. Add some audio clips!</div>';
            return;
        }

        for (const clip of this.currentPlaylistClips) {
            const item = document.createElement('div');
            item.className = 'playlist-clip-item';
            const audioUrl = URL.createObjectURL(clip.audioBlob);

            item.innerHTML = `
                <span><strong>${clip.title}</strong></span>
                <div class="clip-controls">
                    <audio controls src="${audioUrl}"></audio>
                    <span>${this.formatDuration(clip.duration)}</span>
                    <button data-id="${clip.id}" class="remove-clip-btn btn btn-secondary">Remove</button>
                </div>
            `;
            container.appendChild(item);
        }

        // Update the section header with current count
        this.shadowRoot.querySelector('h3').textContent = `Playlist Clips (${this.currentPlaylistClips.length})`;
    }
}

customElements.define('playlist-creator', PlaylistCreator);
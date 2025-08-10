// js/components/playlistCreator.js
// Refactored to use PlaylistService for business logic

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';
import { MessageDb } from '../services/messageDb.js';
import { PlaylistService } from '../services/PlaylistService.js';
import { audioPlayerService } from '../services/audioPlayerService.js';
import './audioRecorder.js';
import './ui/audioPreview.js';

class PlaylistCreator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Initialize services
        this.db = new MessageDb();
        this.playlistService = new PlaylistService(this.db);

        this.render();
        this.setupEventListeners();
    }
    
    async setPlaylistData(playlist) {
        try {
            // Load playlist through service
            const playlistData = await this.playlistService.loadPlaylist(playlist?.id || null);
            
            // Update UI with loaded data
            this.updateUI(playlistData);
            
        } catch (error) {
            log(`Failed to load playlist data: ${error.message}`, 'error');
        }
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
                    min-width: 200px;
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
                
                .playlist-stats {
                    background: #f0f9ff;
                    border: 1px solid #e0f2fe;
                    border-radius: 0.5rem;
                    padding: 0.5rem 1rem;
                }
                
                .stats-text {
                    color: var(--secondary-color);
                    font-size: 0.875rem;
                    font-weight: 500;
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

                <!-- Current Clips Section -->
                <div class="section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 id="clips-header">Playlist Clips (0)</h3>
                        <div class="playlist-stats" id="playlist-stats">
                            <span class="stats-text">No clips yet</span>
                        </div>
                    </div>
                    <div id="clips-container"></div>
                </div>

                <!-- Available Clips Section -->
                <div class="section">
                    <h3>Add from Library</h3>
                    <p>Click any clip to add it to your playlist:</p>
                    <div id="available-clips-container" class="available-clips-container"></div>
                </div>

                <!-- Add New Audio Section -->
                <div class="section">
                    <h3>Add New Audio</h3>
                    <audio-recorder id="audio-recorder"></audio-recorder>
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
            this.handleSavePlaylist();
        });
        
        this.shadowRoot.querySelector('#backToHomeBtn').addEventListener('click', () => {
            eventBus.publish('back-to-home');
        });
        
        this.shadowRoot.querySelector('#finalizePlaylistBtn').addEventListener('click', () => {
            this.handleFinalizePlaylist();
        });
        
        // Listen for remove events from audio-preview components
        this.shadowRoot.addEventListener('clip-remove', (e) => {
            const clipId = parseInt(e.detail.clipId);
            this.playlistService.removeClipFromPlaylist(clipId);
        });
        
        // Handle clicks on available clips
        this.shadowRoot.querySelector('#available-clips-container').addEventListener('click', (e) => {
            if (e.target.closest('.clip-card')) {
                const clipId = parseInt(e.target.closest('.clip-card').dataset.id);
                this.playlistService.addClipToPlaylist({ id: clipId });
            }
        });
        
        // Listen for new audio from recorder (already saved by audioRecorder)
        eventBus.subscribe('audio-saved', (audioData) => {
            this.playlistService.addClipToPlaylist(audioData);
        });

        // Listen for playlist updates from service
        eventBus.subscribe('playlist-updated', (updateData) => {
            this.handlePlaylistUpdate(updateData);
        });

        // Listen for playlist save success
        eventBus.subscribe('playlist-saved', (data) => {
            // Update UI to reflect saved state
            this.updateUI({
                playlist: data.playlist,
                clips: data.clips,
                availableClips: this.playlistService.getAvailableClips()
            });
        });
    }
    
    async handleSavePlaylist() {
        try {
            const playlistTitle = this.shadowRoot.querySelector('#playlistTitle').value.trim();
            const playlistDescription = this.shadowRoot.querySelector('#playlistDescription').value.trim();
            
            if (!playlistTitle) {
                log('Please enter a playlist title.', 'warning');
                return;
            }
            
            const playlistData = {
                id: this.playlistService.currentPlaylist?.id || null,
                name: playlistTitle,
                description: playlistDescription
            };

            await this.playlistService.savePlaylist(playlistData);
            
            // Navigate back to home after successful save
            eventBus.publish('back-to-home');
            
        } catch (error) {
            log(`Failed to save playlist: ${error.message}`, 'error');
        }
    }

    handleFinalizePlaylist() {
        try {
            const playlistTitle = this.shadowRoot.querySelector('#playlistTitle').value.trim();
            
            // Update current playlist name if changed
            if (this.playlistService.currentPlaylist) {
                this.playlistService.currentPlaylist.name = playlistTitle;
            } else {
                this.playlistService.currentPlaylist = { name: playlistTitle };
            }
            
            // Get finalization data from service
            const finalizationData = this.playlistService.getFinalizationData();
            
            // Publish finalization request
            eventBus.publish('finalize-playlist-requested', finalizationData);
            
        } catch (error) {
            log(`Cannot finalize playlist: ${error.message}`, 'warning');
        }
    }

    handlePlaylistUpdate(updateData) {
        // Re-render components that changed
        if (updateData.playlistClips !== undefined) {
            this.renderClips(updateData.playlistClips, updateData.stats);
        }
        
        if (updateData.availableClips !== undefined) {
            this.renderAvailableClips(updateData.availableClips);
        }

        // Log the action for user feedback
        switch (updateData.action) {
            case 'clip-added':
                log(`"${updateData.clip.title}" added to playlist`, 'success');
                break;
            case 'clip-removed':
                log(`"${updateData.clip.title}" removed from playlist`, 'info');
                break;
            case 'clips-reordered':
                log('Playlist clips reordered', 'info');
                break;
        }
    }

    updateUI(playlistData) {
        const { playlist, clips, availableClips } = playlistData;
        
        // Update form fields
        this.shadowRoot.querySelector('#playlistTitle').value = playlist?.name || '';
        this.shadowRoot.querySelector('#playlistDescription').value = playlist?.description || '';
        
        // Update displays
        this.renderClips(clips, this.playlistService.getPlaylistStats());
        this.renderAvailableClips(availableClips);
        
        log(`UI updated for ${playlist ? `"${playlist.name}"` : 'new playlist'}`, 'info');
    }

    renderAvailableClips(availableClips) {
        const container = this.shadowRoot.querySelector('#available-clips-container');
        container.innerHTML = '';

        if (availableClips.length === 0) {
            container.innerHTML = '<div class="empty-state">No available clips. Create some audio clips first!</div>';
            return;
        }

        availableClips.forEach(clip => {
            const card = document.createElement('div');
            card.className = 'clip-card';
            card.dataset.id = clip.id;
            
            // Create audio preview component for available clips
            const audioPreview = document.createElement('audio-preview');
            audioPreview.setAttribute('clip-id', clip.id.toString());
            audioPreview.setAttribute('title', clip.title);
            audioPreview.setAttribute('duration', this.playlistService.formatDuration(clip.duration));
            audioPreview.setAttribute('layout', 'compact');
            audioPreview.setAudioBlob(clip.audioBlob);
            
            card.appendChild(audioPreview);
            card.innerHTML += '<small style="display: block; margin-top: 0.5rem; text-align: center; color: var(--secondary-color);">Click to add to playlist</small>';
            
            container.appendChild(card);
        });
    }

    renderClips(clips, stats) {
        const container = this.shadowRoot.querySelector('#clips-container');
        const headerEl = this.shadowRoot.querySelector('#clips-header');
        const statsEl = this.shadowRoot.querySelector('#playlist-stats .stats-text');
        
        container.innerHTML = '';
        headerEl.textContent = `Playlist Clips (${clips.length})`;

        // Update stats
        if (stats.isEmpty) {
            statsEl.textContent = 'No clips yet';
        } else {
            statsEl.textContent = `${stats.clipCount} clip${stats.clipCount === 1 ? '' : 's'} • Total duration: ${stats.formattedDuration}`;
        }

        if (clips.length === 0) {
            container.innerHTML = '<div class="empty-state">No clips in playlist yet. Add some audio clips!</div>';
            return;
        }

        clips.forEach(clip => {
            // Create audio preview component for playlist clips
            const audioPreview = document.createElement('audio-preview');
            audioPreview.setAttribute('clip-id', clip.id.toString());
            audioPreview.setAttribute('title', clip.title);
            audioPreview.setAttribute('duration', this.playlistService.formatDuration(clip.duration));
            audioPreview.setAttribute('layout', 'playlist');
            audioPreview.setAudioBlob(clip.audioBlob);
            
            container.appendChild(audioPreview);
        });
    }

    // Public API for mainApp.js
    async loadPlaylist(playlist) {
        await this.setPlaylistData(playlist);
    }

    // Get current playlist data for finalization
    getPlaylistData() {
        return this.playlistService.getCurrentState();
    }

    // Cleanup when component is removed
    disconnectedCallback() {
        // Clear playlist service state
        this.playlistService.clearPlaylist();
    }
}

customElements.define('playlist-creator', PlaylistCreator);
// components/playlistCreationView.js

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';
import { MessageDb } from '../services/messageDb.js';

class PlaylistCreationView extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.db = new MessageDb();
        this.currentPlaylistId = null;
        this.currentPlaylistClips = [];
        this.allAvailableClips = [];
        this.currentAudioBlob = null;
        this.currentAudioDuration = 0;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingInterval = null;
        this.recordingStartTime = null;

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
                :host { display: block; }
                .text-center { text-align: center; }
                .space-y-4 > * + * { margin-top: 1rem; }
                .my-6 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
                .btn { padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 0.5rem; cursor: pointer; border: none; transition: background-color 0.3s ease; }
                .btn-primary { background-color: var(--primary-color); color: #ffffff; }
                .btn-secondary { background-color: #e5e7eb; color: #1f2937; }
                .form-input { width: 100%; padding: 0.75rem; border: 2px solid #d1d5db; border-radius: 0.5rem; transition: border-color 0.3s ease; }
                .recording-btn { width: 6rem; height: 6rem; border-radius: 9999px; background-color: var(--accent-color); color: #ffffff; font-size: 1.875rem; display: flex; align-items: center; justify-content: center; margin: auto; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.5); transition: all 0.2s ease; }
                .playlist-clip-item { 
                    background-color: #f9fafb; 
                    padding: 0.75rem; 
                    border-radius: 0.5rem; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); 
                    margin-bottom: 0.5rem;
                }
                .clip-controls {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .clip-controls audio {
                    width: 150px;
                }
                .available-clips-container {
                    display: flex;
                    gap: 1rem;
                    overflow-x: auto;
                    padding-bottom: 1rem;
                    margin-top: 1rem;
                }
                .clip-card {
                    background-color: #f9fafb;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    min-width: 150px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 1px solid transparent;
                }
                .clip-card:hover {
                    border-color: var(--primary-color);
                }
            </style>
            <div id="playlistCreationView">
                <div class="text-center space-y-4">
                    <input type="text" id="playlistTitle" placeholder="Playlist Title" class="form-input">
                    <textarea id="playlistDescription" placeholder="Playlist Description" class="form-input"></textarea>

                    <h3>Add a new message or song</h3>
                    <input type="text" id="message-title-input" placeholder="Message Title" class="form-input">
                    
                    <div id="recording-controls" class="space-y-4">
                        <p class="text-gray-500">Record a new clip:</p>
                        <button id="record-btn" class="recording-btn">
                            <svg id="record-icon" xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v8M8 12h8" />
                            </svg>
                        </button>
                        <p id="recording-timer" class="text-gray-500 hidden">00:00</p>
                    </div>

                    <div class="my-6 text-gray-400 font-bold">-- OR --</div>

                    <div id="upload-controls" class="space-y-4">
                        <p class="text-gray-500">Upload a music file:</p>
                        <input type="file" id="music-file-input" accept="audio/*" class="form-input">
                    </div>

                    <div id="audio-preview-container" class="mt-4 hidden">
                        <audio id="audio-preview" controls class="w-full"></audio>
                    </div>

                    <button id="save-clip-btn" class="mt-6 btn btn-primary hidden">Save to Playlist</button>
                </div>
                
                <div class="mt-8">
                    <h3>Current Clips</h3>
                    <div id="clips-container" class="space-y-2"></div>
                    <div class="flex justify-between items-center">
                        <button id="backToPlaylistsBtn" class="btn btn-secondary">Back to Playlists</button>
                        <button id="savePlaylistBtn" class="btn btn-primary">Save Playlist</button>
                        <button id="finalizePlaylistBtn" class="btn btn-primary">Finalize Playlist</button>
                    </div>
                </div>

                <div class="mt-8">
                    <h3>Available Clips</h3>
                    <div id="available-clips-container" class="available-clips-container"></div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        this.shadowRoot.querySelector('#savePlaylistBtn').addEventListener('click', () => {
            const playlistTitle = this.shadowRoot.querySelector('#playlistTitle').value;
            const playlistDescription = this.shadowRoot.querySelector('#playlistDescription').value;
            const audioClipIds = this.currentPlaylistClips.map(clip => clip.id);
            eventBus.publish('save-playlist-requested', { 
                id: this.currentPlaylistId, 
                name: playlistTitle, 
                description: playlistDescription,
                audioClipIds: audioClipIds
            });
        });
        
        this.shadowRoot.querySelector('#backToPlaylistsBtn').addEventListener('click', () => {
            eventBus.publish('back-to-playlists');
        });
        
        this.shadowRoot.querySelector('#record-btn').addEventListener('click', () => this.toggleRecording());
        this.shadowRoot.querySelector('#music-file-input').addEventListener('change', (e) => this.handleMusicFileUpload(e));
        this.shadowRoot.querySelector('#save-clip-btn').addEventListener('click', () => this.saveClipToPlaylist());
        
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
        
        this.shadowRoot.querySelector('#finalizePlaylistBtn').addEventListener('click', () => {
            eventBus.publish('finalize-playlist-requested');
        });
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
            this.currentPlaylistClips.splice(clipIndex, 1);
            this.renderClips();
            this.renderAvailableClips();
            log(`Clip with ID ${id} removed from the current playlist.`, 'info');
        }
    }

    async renderAvailableClips() {
        const availableClipsContainer = this.shadowRoot.querySelector('#available-clips-container');
        availableClipsContainer.innerHTML = '';

        this.allAvailableClips.forEach(clip => {
            if (!this.currentPlaylistClips.some(c => c.id === clip.id)) {
                const card = document.createElement('div');
                card.className = 'clip-card';
                card.dataset.id = clip.id;
                card.innerHTML = `
                    <h4>${clip.title}</h4>
                    <p>${this.formatDuration(clip.duration)}</p>
                `;
                availableClipsContainer.appendChild(card);
            }
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
        const clipsContainer = this.shadowRoot.querySelector('#clips-container');
        clipsContainer.innerHTML = '';

        for (const clip of this.currentPlaylistClips) {
            const item = document.createElement('div');
            item.className = 'playlist-clip-item';
            const audioUrl = URL.createObjectURL(clip.audioBlob);

            item.innerHTML = `
                <span>${clip.title}</span>
                <div class="clip-controls">
                    <audio controls src="${audioUrl}"></audio>
                    <span class="clip-duration">${this.formatDuration(clip.duration)}</span>
                    <button data-id="${clip.id}" class="remove-clip-btn">Remove</button>
                </div>
            `;
            clipsContainer.appendChild(item);
        }
    }
    
    toggleRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        } else {
            this.startRecording();
        }
    }

    async startRecording() {
        if (!this.shadowRoot.querySelector('#message-title-input').value.trim()) {
            log('Please add a title for this message before recording.', 'warning');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);
            this.mediaRecorder.onstop = () => {
                this.currentAudioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.currentAudioDuration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                this.shadowRoot.querySelector('#audio-preview').src = URL.createObjectURL(this.currentAudioBlob);
                this.shadowRoot.querySelector('#audio-preview-container').classList.remove('hidden');
                this.shadowRoot.querySelector('#save-clip-btn').classList.remove('hidden');
                stream.getTracks().forEach(track => track.stop());
                log('Recording finished. Audio preview ready.', 'success');
                clearInterval(this.recordingInterval);
            };
            this.mediaRecorder.start();
            this.recordingStartTime = Date.now();
            this.shadowRoot.querySelector('#recording-timer').textContent = '00:00';
            this.shadowRoot.querySelector('#recording-timer').classList.remove('hidden');
            this.shadowRoot.querySelector('#record-btn').classList.add('pulse');
            log('Recording started.', 'info');
            this.recordingInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                this.shadowRoot.querySelector('#recording-timer').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }, 1000);
        } catch (err) { log(`Error accessing microphone: ${err.message}`, 'error'); }
    }

    handleMusicFileUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.currentAudioBlob = file;
            this.currentAudioDuration = 0;
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                this.currentAudioDuration = audio.duration;
                URL.revokeObjectURL(audio.src);
            };
            audio.src = URL.createObjectURL(file);
            
            this.shadowRoot.querySelector('#audio-preview').src = URL.createObjectURL(file);
            this.shadowRoot.querySelector('#audio-preview-container').classList.remove('hidden');
            this.shadowRoot.querySelector('#save-clip-btn').classList.remove('hidden');
            this.shadowRoot.querySelector('#recording-timer').classList.add('hidden');
            log(`Uploaded music file: ${file.name}`, 'success');
        } else {
            this.currentAudioBlob = null;
            this.currentAudioDuration = 0;
            this.shadowRoot.querySelector('#audio-preview-container').classList.add('hidden');
            this.shadowRoot.querySelector('#save-clip-btn').classList.add('hidden');
        }
    }
    
    async saveClipToPlaylist() {
        if (!this.currentAudioBlob) {
            log('No audio clip to save.', 'warning');
            return;
        }
        const title = this.shadowRoot.querySelector('#message-title-input').value.trim() || 'Untitled Message';
        try {
            const clipId = await this.db.saveAudioClip(title, this.currentAudioBlob, this.currentAudioDuration);
            const savedClip = { id: clipId, title: title, audioBlob: this.currentAudioBlob, duration: this.currentAudioDuration };
            this.currentPlaylistClips.push(savedClip);
            this.allAvailableClips.push(savedClip);
            log(`Message "${title}" saved to local database.`, 'success');
            this.renderClips();
            this.renderAvailableClips();
            this.shadowRoot.querySelector('#message-title-input').value = '';
            this.shadowRoot.querySelector('#audio-preview-container').classList.add('hidden');
            this.shadowRoot.querySelector('#save-clip-btn').classList.add('hidden');
            this.shadowRoot.querySelector('#music-file-input').value = null;
            this.currentAudioBlob = null;
            this.currentAudioDuration = 0;
        } catch (err) { log(`Failed to save to IndexedDB: ${err.message}`, 'error'); }
    }
}
customElements.define('playlist-creation-view', PlaylistCreationView);
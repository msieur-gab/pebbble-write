// components/audioManagement.js

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';
import { stateManager } from '../services/stateManager.js';
import { MessageDb } from '../services/messageDb.js';

class AudioManagementComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.db = new MessageDb();
        this.currentAudioBlob = null;
        this.currentAudioDuration = 0;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingInterval = null;
        this.recordingStartTime = null;

        this.render();
        this.setupEventListeners();
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .text-center { text-align: center; }
                .space-y-4 > * + * { margin-top: 1rem; }
                .my-6 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
                .form-input { width: 100%; padding: 0.75rem; border: 2px solid #d1d5db; border-radius: 0.5rem; transition: border-color 0.3s ease; }
                .recording-btn { width: 6rem; height: 6rem; border-radius: 9999px; background-color: var(--accent-color); color: #ffffff; font-size: 1.875rem; display: flex; align-items: center; justify-content: center; margin: auto; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.5); transition: all 0.2s ease; }
                .recording-btn.pulse { animation: pulse 1.5s infinite; }
                .hidden { display: none; }
                .btn { padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 0.5rem; cursor: pointer; border: none; transition: background-color 0.3s ease; }
                .btn-primary { background-color: var(--primary-color); color: #ffffff; }
            </style>
            <div>
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
                    <div class="flex space-x-4 mt-4">
                         <button id="delete-clip-btn" class="btn btn-secondary">Delete</button>
                         <button id="save-clip-btn" class="btn btn-primary">Save</button>
                    </div>
                </div>

                <div class="flex justify-between items-center mt-8">
                    <button id="backToHomeBtn" class="btn btn-secondary">Back to Home Screen</button>
                </div>

            </div>
        `;
    }

    setupEventListeners() {
        this.shadowRoot.querySelector('#record-btn').addEventListener('click', () => this.toggleRecording());
        this.shadowRoot.querySelector('#music-file-input').addEventListener('change', (e) => this.handleMusicFileUpload(e));
        this.shadowRoot.querySelector('#save-clip-btn').addEventListener('click', () => this.saveClip());
        this.shadowRoot.querySelector('#delete-clip-btn').addEventListener('click', () => this.resetUI());
        this.shadowRoot.querySelector('#backToHomeBtn').addEventListener('click', () => {
             stateManager.setAppView('homeView');
        });
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
            this.shadowRoot.querySelector('#recording-timer').classList.add('hidden');
            log(`Uploaded music file: ${file.name}`, 'success');
        } else {
            this.currentAudioBlob = null;
            this.currentAudioDuration = 0;
            this.shadowRoot.querySelector('#audio-preview-container').classList.add('hidden');
        }
    }
    
    async saveClip() {
        if (!this.currentAudioBlob) {
            log('No audio clip to save.', 'warning');
            return;
        }
        const title = this.shadowRoot.querySelector('#message-title-input').value.trim() || 'Untitled Message';
        try {
            await this.db.saveAudioClip(title, this.currentAudioBlob, this.currentAudioDuration);
            log(`Message "${title}" saved to local database.`, 'success');
            this.resetUI();
            stateManager.setAppView('homeView');
        } catch (err) { log(`Failed to save to IndexedDB: ${err.message}`, 'error'); }
    }

    resetUI() {
        this.shadowRoot.querySelector('#message-title-input').value = '';
        this.shadowRoot.querySelector('#audio-preview-container').classList.add('hidden');
        this.shadowRoot.querySelector('#music-file-input').value = null;
        this.currentAudioBlob = null;
        this.currentAudioDuration = 0;
        const recordBtn = this.shadowRoot.querySelector('#record-btn');
        recordBtn.classList.remove('pulse');
        recordBtn.innerHTML = `
            <svg id="record-icon" xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8M8 12h8" />
            </svg>
        `;
        this.shadowRoot.querySelector('#recording-timer').classList.add('hidden');
    }
}
customElements.define('audio-management', AudioManagementComponent);
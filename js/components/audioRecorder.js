// js/components/audioRecorder.js

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';

class AudioRecorder extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Audio state
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
                :host { display: block; }
                .audio-recorder {
                    text-align: center;
                    padding: 1rem;
                }
                .space-y-4 > * + * { margin-top: 1rem; }
                .my-6 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
                .form-input { 
                    width: 100%; 
                    padding: 0.75rem; 
                    border: 2px solid #d1d5db; 
                    border-radius: 0.5rem; 
                    transition: border-color 0.3s ease; 
                }
                .form-input:focus { outline: none; border-color: var(--primary-color); }
                
                .recording-btn { 
                    width: 6rem; 
                    height: 6rem; 
                    border-radius: 9999px; 
                    background-color: var(--accent-color); 
                    color: #ffffff; 
                    font-size: 1.875rem; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    margin: auto; 
                    box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.5); 
                    transition: all 0.2s ease; 
                    border: none;
                    cursor: pointer;
                }
                .recording-btn:hover { transform: scale(1.1); }
                .recording-btn.pulse { animation: pulse 1.5s infinite; }
                
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
                
                .btn { 
                    padding: 0.75rem 1.5rem; 
                    font-weight: 700; 
                    border-radius: 0.5rem; 
                    cursor: pointer; 
                    border: none; 
                    transition: background-color 0.3s ease; 
                }
                .btn-primary { background-color: var(--primary-color); color: #ffffff; }
                .btn-secondary { background-color: #e5e7eb; color: #1f2937; }
                .btn:hover.btn-primary { background-color: var(--button-hover); }
                .btn:hover.btn-secondary { background-color: #d1d5db; }
                
                .hidden { display: none; }
                .audio-preview-section { margin-top: 1rem; }
                .preview-controls { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; }
                
                .text-gray-500 { color: var(--secondary-color); }
                .text-gray-400 { color: #9ca3af; }
            </style>
            
            <div class="audio-recorder space-y-4">
                <input type="text" id="audio-title-input" placeholder="Audio Title" class="form-input">
                
                <div id="recording-controls" class="space-y-4">
                    <p class="text-gray-500">Record a new clip:</p>
                    <button id="record-btn" class="recording-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10" />
                        </svg>
                    </button>
                    <p id="recording-timer" class="text-gray-500 hidden">00:00</p>
                </div>

                <div class="my-6 text-gray-400 font-bold">-- OR --</div>

                <div id="upload-controls" class="space-y-4">
                    <p class="text-gray-500">Upload a music file:</p>
                    <input type="file" id="music-file-input" accept="audio/*" class="form-input">
                </div>

                <div id="audio-preview-section" class="audio-preview-section hidden">
                    <audio id="audio-preview" controls style="width: 100%; margin: 1rem 0;"></audio>
                    <div class="preview-controls">
                        <button id="delete-audio-btn" class="btn btn-secondary">Delete</button>
                        <button id="save-audio-btn" class="btn btn-primary">Save Audio</button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        this.shadowRoot.querySelector('#record-btn').addEventListener('click', () => this.toggleRecording());
        this.shadowRoot.querySelector('#music-file-input').addEventListener('change', (e) => this.handleMusicFileUpload(e));
        this.shadowRoot.querySelector('#save-audio-btn').addEventListener('click', () => this.saveAudio());
        this.shadowRoot.querySelector('#delete-audio-btn').addEventListener('click', () => this.resetRecorder());
    }

    toggleRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        } else {
            this.startRecording();
        }
    }

    async startRecording() {
        const titleInput = this.shadowRoot.querySelector('#audio-title-input');
        if (!titleInput.value.trim()) {
            log('Please add a title for this audio before recording.', 'warning');
            titleInput.focus();
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
                this.showAudioPreview();
                stream.getTracks().forEach(track => track.stop());
                log('Recording finished. Audio preview ready.', 'success');
                clearInterval(this.recordingInterval);
            };
            
            this.mediaRecorder.start();
            this.recordingStartTime = Date.now();
            this.startRecordingUI();
            log('Recording started.', 'info');
            
        } catch (err) {
            log(`Error accessing microphone: ${err.message}`, 'error');
        }
    }

    startRecordingUI() {
        const recordBtn = this.shadowRoot.querySelector('#record-btn');
        const timer = this.shadowRoot.querySelector('#recording-timer');
        
        recordBtn.classList.add('pulse');
        recordBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="6" width="12" height="12"></rect>
            </svg>
        `;
        
        timer.textContent = '00:00';
        timer.classList.remove('hidden');
        
        this.recordingInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    }

    handleMusicFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.currentAudioBlob = file;
            this.currentAudioDuration = 0;
            
            // Get duration from the file
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                this.currentAudioDuration = audio.duration;
                URL.revokeObjectURL(audio.src);
            };
            audio.src = URL.createObjectURL(file);
            
            this.showAudioPreview();
            log(`Uploaded music file: ${file.name}`, 'success');
        }
    }

    showAudioPreview() {
        const previewSection = this.shadowRoot.querySelector('#audio-preview-section');
        const audioPreview = this.shadowRoot.querySelector('#audio-preview');
        const timer = this.shadowRoot.querySelector('#recording-timer');
        
        audioPreview.src = URL.createObjectURL(this.currentAudioBlob);
        previewSection.classList.remove('hidden');
        timer.classList.add('hidden');
        
        // Reset recording button
        this.resetRecordingButton();
    }

    resetRecordingButton() {
        const recordBtn = this.shadowRoot.querySelector('#record-btn');
        recordBtn.classList.remove('pulse');
        recordBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
            </svg>
        `;
    }

    async saveAudio() {
        if (!this.currentAudioBlob) {
            log('No audio to save.', 'warning');
            return;
        }
        
        const title = this.shadowRoot.querySelector('#audio-title-input').value.trim() || 'Untitled Audio';
        
        // Emit event with audio data
        eventBus.publish('audio-recorded', {
            title: title,
            audioBlob: this.currentAudioBlob,
            duration: this.currentAudioDuration
        });
        
        log(`Audio "${title}" ready to save.`, 'success');
        this.resetRecorder();
    }

    resetRecorder() {
        // Clear audio state
        this.currentAudioBlob = null;
        this.currentAudioDuration = 0;
        
        // Reset UI
        this.shadowRoot.querySelector('#audio-title-input').value = '';
        this.shadowRoot.querySelector('#music-file-input').value = '';
        this.shadowRoot.querySelector('#audio-preview-section').classList.add('hidden');
        this.shadowRoot.querySelector('#recording-timer').classList.add('hidden');
        
        this.resetRecordingButton();
        
        // Clear any ongoing recording
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }
    }

    // Public methods for parent components
    getAudioData() {
        return {
            title: this.shadowRoot.querySelector('#audio-title-input').value.trim(),
            audioBlob: this.currentAudioBlob,
            duration: this.currentAudioDuration
        };
    }

    hasAudio() {
        return !!this.currentAudioBlob;
    }

    setTitle(title) {
        this.shadowRoot.querySelector('#audio-title-input').value = title || '';
    }
}

customElements.define('audio-recorder', AudioRecorder);
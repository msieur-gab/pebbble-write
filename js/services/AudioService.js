// js/services/AudioService.js
// Extracted audio business logic from audioRecorder.js

import { log } from '../utils/log.js';

export class AudioService {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = null;
    }

    /**
     * Get supported audio format for recording
     * @returns {string} Supported MIME type
     */
    getSupportedMimeType() {
        const types = ['audio/mp4', 'audio/webm', 'audio/ogg'];
        const supported = types.find(type => MediaRecorder.isTypeSupported(type));
        
        if (!supported) {
            log('No supported audio format found, using default', 'warning');
            return 'audio/webm'; // Fallback
        }
        
        log(`Using audio format: ${supported}`, 'info');
        return supported;
    }

    /**
     * Start audio recording
     * @returns {Promise<void>} Resolves when recording starts
     */
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            
            const mimeType = this.getSupportedMimeType();
            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.audioChunks = [];
            this.recordingStartTime = Date.now();
            
            // Set up internal event handlers
            this.mediaRecorder.ondataavailable = event => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.start();
            log('Audio recording started', 'info');
            
        } catch (error) {
            log(`Failed to start recording: ${error.message}`, 'error');
            throw new Error(`Microphone access denied: ${error.message}`);
        }
    }

    /**
     * Stop audio recording and create blob
     * @returns {Promise<Object>} Recording result with blob and duration
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                reject(new Error('No active recording to stop'));
                return;
            }

            this.mediaRecorder.ondataavailable = event => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const mimeType = this.getSupportedMimeType();
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                
                // Clean up media stream
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                
                log(`Recording stopped. Duration: ${duration}s, Size: ${audioBlob.size} bytes`, 'success');
                
                resolve({
                    audioBlob,
                    duration,
                    size: audioBlob.size,
                    mimeType
                });
            };

            this.mediaRecorder.onerror = (error) => {
                log(`Recording error: ${error.message}`, 'error');
                reject(error);
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Validate uploaded audio file
     * @param {File} file - File to validate
     * @returns {Object} Validation result
     */
    validateAudioFile(file) {
        const validTypes = [
            'audio/mp3', 'audio/mpeg',
            'audio/wav', 'audio/wave',
            'audio/ogg', 'audio/webm',
            'audio/m4a', 'audio/mp4'
        ];
        
        const isValidType = validTypes.some(type => 
            file.type === type || file.type.includes(type.split('/')[1])
        );
        
        if (!isValidType) {
            return {
                valid: false,
                error: `Unsupported file type: ${file.type}. Please use MP3, WAV, OGG, or M4A files.`
            };
        }
        
        // Check file size (max 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File too large: ${this.formatFileSize(file.size)}. Maximum size is 50MB.`
            };
        }
        
        log(`Audio file validated: ${file.name} (${this.formatFileSize(file.size)})`, 'success');
        return { valid: true };
    }

    /**
     * Process uploaded audio file
     * @param {File} file - Audio file to process
     * @returns {Promise<Object>} Processed audio data
     */
    async processUploadedFile(file) {
        const validation = this.validateAudioFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const duration = await this.getAudioDuration(file);
        
        log(`Processed uploaded file: ${file.name}`, 'success');
        return {
            audioBlob: file,
            duration,
            size: file.size,
            mimeType: file.type,
            originalName: file.name
        };
    }

    /**
     * Get audio duration from blob/file
     * @param {Blob|File} audioBlob - Audio blob/file
     * @returns {Promise<number>} Duration in seconds
     */
    async getAudioDuration(audioBlob) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                const duration = audio.duration || 0;
                URL.revokeObjectURL(audio.src);
                resolve(duration);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(audio.src);
                resolve(0);
            };
            audio.src = URL.createObjectURL(audioBlob);
        });
    }

    /**
     * Format file size for display
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Format duration for display
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration (e.g., "1:23")
     */
    formatDuration(seconds) {
        if (isNaN(seconds) || seconds === Infinity || !seconds) {
            return '0:00';
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    /**
     * Check if recording is currently active
     * @returns {boolean} True if recording
     */
    isRecording() {
        return this.mediaRecorder && this.mediaRecorder.state === 'recording';
    }

    /**
     * Get current recording duration
     * @returns {number} Duration in seconds since recording started
     */
    getCurrentRecordingDuration() {
        if (!this.recordingStartTime) return 0;
        return Math.floor((Date.now() - this.recordingStartTime) / 1000);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = null;
    }
}
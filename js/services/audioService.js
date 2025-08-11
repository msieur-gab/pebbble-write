// js/services/audioService.js
// Fixed: Added proper cleanup to prevent memory leaks

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

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                log('Screen wake lock activated for recording', 'info');
            } catch (error) {
                log(`Wake lock failed: ${error.message}`, 'warning');
                // Continue without wake lock - not critical
            }
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
            log('Screen wake lock released', 'info');
        }
    }

    /**
     * Start audio recording
     * @returns {Promise<void>} Resolves when recording starts
     */
    async startRecording() {
        try {
            await this.requestWakeLock();
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
            await this.requestWakeLock();
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
                this.releaseWakeLock();
                reject(new Error('No active recording to stop'));
                return;
            }

            this.mediaRecorder.ondataavailable = event => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                this.releaseWakeLock();
                const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const mimeType = this.getSupportedMimeType();
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                
                // Clean up media stream immediately
                if (this.mediaRecorder.stream) {
                    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
                
                log(`Recording stopped. Duration: ${duration}s, Size: ${audioBlob.size} bytes`, 'success');
                
                resolve({
                    audioBlob,
                    duration,
                    size: audioBlob.size,
                    mimeType
                });
            };

            this.mediaRecorder.onerror = (error) => {
                this.releaseWakeLock();
                log(`Recording error: ${error.message}`, 'error');
                this.cleanup(); // Clean up on error
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
     * Test if current device can play specific audio format
     * @param {string} mimeType - MIME type to test
     * @returns {boolean} True if playback supported
     */
    canPlayFormat(mimeType) {
        const audio = new Audio();
        const canPlay = audio.canPlayType(mimeType);
        
        // canPlayType returns: "", "maybe", or "probably"
        const isSupported = canPlay === "probably" || canPlay === "maybe";
        log(`Playback test: ${mimeType} - ${canPlay || 'not supported'} (${isSupported ? 'OK' : 'FAIL'})`, 'info');
        
        return isSupported;
    }

    /**
     * Get the best universal format for both recording AND playback
     * @returns {Object} Format info with recording and playback compatibility
     */
    getBestUniversalFormat() {
        const formats = [
            { mime: 'audio/mp4', name: 'MP4/AAC' },
            { mime: 'audio/mp4;codecs=mp4a.40.2', name: 'MP4/AAC (explicit)' },
            { mime: 'audio/webm;codecs=opus', name: 'WebM/Opus' },
            { mime: 'audio/webm', name: 'WebM' },
            { mime: 'audio/ogg;codecs=opus', name: 'OGG/Opus' }
        ];

        for (const format of formats) {
            const canRecord = MediaRecorder.isTypeSupported(format.mime);
            const canPlay = this.canPlayFormat(format.mime);
            
            log(`Format test: ${format.name} - Record: ${canRecord ? '✅' : '❌'}, Play: ${canPlay ? '✅' : '❌'}`, 'info');
            
            if (canRecord && canPlay) {
                log(`🎯 Best universal format: ${format.name}`, 'success');
                return {
                    mimeType: format.mime,
                    name: format.name,
                    canRecord: true,
                    canPlay: true
                };
            }
        }

        // If no format works for both, find best recording format
        const recordingFormat = formats.find(f => MediaRecorder.isTypeSupported(f.mime));
        if (recordingFormat) {
            log(`⚠️ Using recording format with limited playback: ${recordingFormat.name}`, 'warning');
            return {
                mimeType: recordingFormat.mime,
                name: recordingFormat.name,
                canRecord: true,
                canPlay: this.canPlayFormat(recordingFormat.mime)
            };
        }

        throw new Error('No compatible audio formats found for this device');
    }

     /* @param {File} file - Audio file to process
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
            let tempUrl = null;
            
            audio.onloadedmetadata = () => {
                const duration = audio.duration || 0;
                // Clean up immediately after getting duration
                if (tempUrl) {
                    URL.revokeObjectURL(tempUrl);
                }
                resolve(duration);
            };
            
            audio.onerror = () => {
                // Clean up on error too
                if (tempUrl) {
                    URL.revokeObjectURL(tempUrl);
                }
                resolve(0);
            };
            
            tempUrl = URL.createObjectURL(audioBlob);
            audio.src = tempUrl;
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
     * Clean up resources - FIXED: Proper memory cleanup
     */
    cleanup() {
        // Release wake lock during cleanup
        this.releaseWakeLock();
    
        // Stop and clean up media recorder
        if (this.mediaRecorder) {
            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            
            // Clean up media stream
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => {
                    track.stop();
                    log('Audio track stopped', 'info');
                });
            }
            
            this.mediaRecorder = null;
        }
        
        // Clear audio chunks array
        this.audioChunks = [];
        this.recordingStartTime = null;
        
        log('AudioService cleanup completed', 'info');
    }
}
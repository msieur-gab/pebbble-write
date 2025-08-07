// js/services/audioPlayerService.js
// This new service centrally manages audio playback to prevent multiple tracks from playing.

import { eventBus } from './eventBus.js';
import { log } from '../utils/log.js';

class AudioPlayerService {
    constructor() {
        // Create a single, hidden audio element to manage all playback
        this.audioElement = new Audio();
        this.currentUrl = null;
        this.currentPlayingId = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.audioElement.addEventListener('ended', () => {
            log('Audio playback ended.', 'info');
            this.currentPlayingId = null;
        });

        // Listen for requests to play a new audio track
        eventBus.subscribe('play-audio', (data) => {
            this.play(data.id, data.audioBlob);
        });

        // Listen for requests to pause audio playback
        eventBus.subscribe('pause-audio', (data) => {
            if (this.currentPlayingId === data.id) {
                this.pause();
            }
        });

        // Listen for requests to stop audio playback
        eventBus.subscribe('stop-audio', () => {
            this.stop();
        });

        // Stop audio on navigation events
        eventBus.subscribe('back-to-home', () => {
            this.stop();
        });
        
        eventBus.subscribe('new-playlist-requested', () => {
            this.stop();
        });
        
        eventBus.subscribe('new-recording-requested', () => {
            this.stop();
        });
        
        eventBus.subscribe('open-playlist', () => {
            this.stop();
        });
    }

    play(id, audioBlob) {
        if (!audioBlob) {
            log('No audio data to play.', 'warning');
            return;
        }

        // If the same track is already playing, just pause it
        if (this.currentPlayingId === id && !this.audioElement.paused) {
            this.pause();
            return;
        }
        
        // If a different track is playing, pause it first
        if (!this.audioElement.paused) {
            this.pause();
        }

        // If a different audio is loaded, revoke the old URL and create a new one
        if (this.currentUrl && this.currentPlayingId !== id) {
            URL.revokeObjectURL(this.currentUrl);
        }

        // Load the new audio track
        this.currentUrl = URL.createObjectURL(audioBlob);
        this.audioElement.src = this.currentUrl;
        this.currentPlayingId = id;

        // Play the new track
        this.audioElement.play().then(() => {
            log(`Started playing audio ID: ${id}`, 'info');
        }).catch(error => {
            log(`Failed to play audio: ${error.message}`, 'error');
        });
    }

    pause() {
        if (!this.audioElement.paused) {
            this.audioElement.pause();
            log('Audio playback paused.', 'info');
        }
    }

    stop() {
        if (!this.audioElement.paused) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
        
        const stoppedId = this.currentPlayingId;
        this.currentPlayingId = null;
        
        if (stoppedId) {
            eventBus.publish('audio-ended', { id: stoppedId });
        }
        
        log('Audio playback stopped.', 'info');
    }

    // Public method to check if a specific track is playing
    isPlaying(id) {
        return this.currentPlayingId === id && !this.audioElement.paused;
    }
}

export const audioPlayerService = new AudioPlayerService();
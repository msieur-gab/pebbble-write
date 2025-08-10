// js/services/audioPlayerService.js
// Fixed: Added proper URL cleanup to prevent memory leaks

import { eventBus } from './eventBus.js';
import { log } from '../utils/log.js';

class AudioPlayerService {
    constructor() {
        this.audioElement = new Audio();
        this.currentUrl = null;
        this.currentPlayingId = null;
        
        this.setupEventListeners();
        this.startStateMonitor();
    }

    setupEventListeners() {
        // Handle audio ending naturally
        this.audioElement.addEventListener('ended', () => {
            log('Audio playback ended.', 'info');
            const endedId = this.currentPlayingId;
            this.currentPlayingId = null;
            
            // Clean up URL when audio ends
            this.cleanupCurrentUrl();
            
            if (endedId) {
                eventBus.publish('audio-state-changed', { 
                    id: endedId, 
                    isPlaying: false 
                });
            }
        });

        // Handle play requests
        eventBus.subscribe('play-audio', (data) => {
            this.play(data.id, data.audioBlob);
        });

        // Handle pause requests  
        eventBus.subscribe('pause-audio', (data) => {
            if (this.currentPlayingId === data.id) {
                this.pause();
            }
        });

        // Handle stop requests
        eventBus.subscribe('stop-audio', () => {
            this.stop();
        });

        // Stop on navigation
        eventBus.subscribe('back-to-home', () => this.stop());
        eventBus.subscribe('new-playlist-requested', () => this.stop());
        eventBus.subscribe('new-recording-requested', () => this.stop());
        eventBus.subscribe('open-playlist', () => this.stop());
    }

    // Monitor actual audio state and sync components
    startStateMonitor() {
        setInterval(() => {
            if (this.currentPlayingId) {
                const actuallyPlaying = !this.audioElement.paused && !this.audioElement.ended;
                
                // If we think something is playing but it's not, fix it
                if (!actuallyPlaying) {
                    const stoppedId = this.currentPlayingId;
                    this.currentPlayingId = null;
                    
                    // Clean up URL when playback stops unexpectedly
                    this.cleanupCurrentUrl();
                    
                    eventBus.publish('audio-state-changed', { 
                        id: stoppedId, 
                        isPlaying: false 
                    });
                }
            }
        }, 500); // Check twice per second
    }

    // FIXED: Clean up old URLs to prevent memory leaks
    cleanupCurrentUrl() {
        if (this.currentUrl) {
            URL.revokeObjectURL(this.currentUrl);
            this.currentUrl = null;
            log('Cleaned up audio blob URL', 'info');
        }
    }

    play(id, audioBlob) {
        if (!audioBlob) {
            log('No audio data to play.', 'warning');
            return;
        }

        // If same track is playing, pause it
        if (this.currentPlayingId === id && !this.audioElement.paused) {
            this.pause();
            return;
        }

        // Stop any currently playing track
        const previousId = this.currentPlayingId;
        if (previousId && previousId !== id) {
            this.audioElement.pause();
            eventBus.publish('audio-state-changed', { 
                id: previousId, 
                isPlaying: false 
            });
        }

        // FIXED: Clean up old URL before creating new one
        this.cleanupCurrentUrl();

        // Setup new audio
        this.currentUrl = URL.createObjectURL(audioBlob);
        this.audioElement.src = this.currentUrl;
        this.currentPlayingId = id;

        // Play it
        this.audioElement.play()
            .then(() => {
                log(`Started playing audio ID: ${id}`, 'info');
                eventBus.publish('audio-state-changed', { 
                    id: id, 
                    isPlaying: true 
                });
            })
            .catch(error => {
                log(`Failed to play audio: ${error.message}`, 'error');
                this.currentPlayingId = null;
                this.cleanupCurrentUrl(); // Clean up on error
                eventBus.publish('audio-state-changed', { 
                    id: id, 
                    isPlaying: false 
                });
            });
    }

    pause() {
        if (this.currentPlayingId && !this.audioElement.paused) {
            const pausedId = this.currentPlayingId;
            this.audioElement.pause();
            this.currentPlayingId = null;
            
            // Clean up URL when pausing
            this.cleanupCurrentUrl();
            
            log('Audio playback paused.', 'info');
            eventBus.publish('audio-state-changed', { 
                id: pausedId, 
                isPlaying: false 
            });
        }
    }

    stop() {
        if (this.currentPlayingId) {
            const stoppedId = this.currentPlayingId;
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.currentPlayingId = null;
            
            // Clean up URL when stopping
            this.cleanupCurrentUrl();
            
            eventBus.publish('audio-state-changed', { 
                id: stoppedId, 
                isPlaying: false 
            });
        }
        log('Audio playback stopped.', 'info');
    }

    // Public method to check if specific track is playing
    isPlaying(id) {
        return this.currentPlayingId === id && 
               !this.audioElement.paused && 
               !this.audioElement.ended;
    }

    // Public method to get current playing ID
    getCurrentlyPlaying() {
        return this.currentPlayingId;
    }

    // FIXED: Add cleanup method for service shutdown
    cleanup() {
        this.stop();
        this.cleanupCurrentUrl();
        log('AudioPlayerService cleanup completed', 'info');
    }
}

export const audioPlayerService = new AudioPlayerService();
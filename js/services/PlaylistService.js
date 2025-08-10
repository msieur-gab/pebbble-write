// js/services/PlaylistService.js
// Extracted playlist business logic from playlistCreator.js

import { log } from '../utils/log.js';
import { eventBus } from './eventBus.js';

export class PlaylistService {
    constructor(messageDb) {
        this.db = messageDb;
        this.currentPlaylist = null;
        this.currentPlaylistClips = [];
        this.allAvailableClips = [];
    }

    /**
     * Initialize service with playlist data
     * @param {Object|null} playlist - Playlist to load, null for new playlist
     */
    async initialize(playlist = null) {
        if (playlist) {
            this.currentPlaylist = playlist;
            this.currentPlaylistClips = await this.db.getAudioClipsForPlaylist(playlist.id);
            log(`Loaded playlist "${playlist.name}" with ${this.currentPlaylistClips.length} clips`, 'info');
        } else {
            this.currentPlaylist = null;
            this.currentPlaylistClips = [];
            log('Initialized new playlist', 'info');
        }

        // Always load all available clips
        this.allAvailableClips = await this.db.getAllAudioClips();
        log(`Loaded ${this.allAvailableClips.length} available clips`, 'info');
        
        this.notifyChange();
    }

    /**
     * Add a new audio clip to the current playlist
     * @param {Object} audioData - Audio data from recording/upload
     * @returns {Promise<Object>} Saved clip data
     */
    async addNewAudioClip(audioData) {
        try {
            const { title, audioBlob, duration } = audioData;
            
            // Save to database
            const clipId = await this.db.saveAudioClip(title, audioBlob, duration);
            const savedClip = { 
                id: clipId, 
                title: title, 
                audioBlob: audioBlob, 
                duration: duration,
                timestamp: Date.now()
            };
            
            // Add to current playlist
            this.currentPlaylistClips.push(savedClip);
            
            // Add to available clips
            this.allAvailableClips.push(savedClip);
            
            log(`Audio "${title}" added to playlist`, 'success');
            this.notifyChange();
            
            return savedClip;
        } catch (error) {
            log(`Failed to save audio: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Add existing clip to current playlist
     * @param {number} clipId - ID of clip to add
     * @returns {Promise<boolean>} Success status
     */
    async addExistingClipToPlaylist(clipId) {
        try {
            const clipToAdd = await this.db.getAudioClip(clipId);
            
            if (!clipToAdd) {
                throw new Error('Clip not found');
            }
            
            // Check if already in playlist
            if (this.currentPlaylistClips.some(clip => clip.id === clipId)) {
                log(`Clip "${clipToAdd.title}" is already in playlist`, 'warning');
                return false;
            }
            
            this.currentPlaylistClips.push(clipToAdd);
            log(`Clip "${clipToAdd.title}" added to playlist`, 'info');
            this.notifyChange();
            
            return true;
        } catch (error) {
            log(`Failed to add clip to playlist: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Remove clip from current playlist
     * @param {number} clipId - ID of clip to remove
     * @returns {boolean} Success status
     */
    removeClipFromPlaylist(clipId) {
        const clipIndex = this.currentPlaylistClips.findIndex(clip => clip.id === clipId);
        
        if (clipIndex === -1) {
            log('Clip not found in playlist', 'warning');
            return false;
        }
        
        const removedClip = this.currentPlaylistClips[clipIndex];
        this.currentPlaylistClips.splice(clipIndex, 1);
        
        log(`Clip "${removedClip.title}" removed from playlist`, 'info');
        this.notifyChange();
        
        return true;
    }

    /**
     * Reorder clips in playlist
     * @param {Array<number>} newOrder - Array of clip IDs in new order
     */
    reorderPlaylistClips(newOrder) {
        const reorderedClips = newOrder.map(id => 
            this.currentPlaylistClips.find(clip => clip.id === id)
        ).filter(Boolean);
        
        this.currentPlaylistClips = reorderedClips;
        log('Playlist clips reordered', 'info');
        this.notifyChange();
    }

    /**
     * Save current playlist to database
     * @param {Object} playlistData - Playlist metadata (name, description)
     * @returns {Promise<Object>} Saved playlist
     */
    async savePlaylist(playlistData) {
        try {
            const { name, description } = playlistData;
            
            // Validate playlist data
            const validation = this.validatePlaylistData({ name, description });
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            const playlist = {
                name: name.trim(),
                description: description.trim(),
                audioClipIds: this.currentPlaylistClips.map(clip => clip.id),
                timestamp: Date.now()
            };

            // Update existing or create new
            if (this.currentPlaylist?.id) {
                playlist.id = this.currentPlaylist.id;
            }

            const savedPlaylist = await this.db.savePlaylist(playlist);
            this.currentPlaylist = savedPlaylist;
            
            log(`Playlist "${name}" saved successfully`, 'success');
            return savedPlaylist;
            
        } catch (error) {
            log(`Failed to save playlist: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Validate playlist data
     * @param {Object} data - Playlist data to validate
     * @returns {Object} Validation result
     */
    validatePlaylistData(data) {
        const { name, description } = data;
        
        if (!name || name.trim().length === 0) {
            return { valid: false, error: 'Playlist name is required' };
        }
        
        if (name.trim().length > 100) {
            return { valid: false, error: 'Playlist name must be less than 100 characters' };
        }
        
        if (description && description.length > 500) {
            return { valid: false, error: 'Description must be less than 500 characters' };
        }
        
        return { valid: true };
    }

    /**
     * Validate playlist for finalization
     * @returns {Object} Validation result
     */
    validateForFinalization() {
        if (!this.currentPlaylist) {
            return { valid: false, error: 'Please save the playlist before finalizing' };
        }
        
        if (this.currentPlaylistClips.length === 0) {
            return { valid: false, error: 'Cannot finalize an empty playlist. Please add some audio clips.' };
        }
        
        // Check for clips without audio data
        const invalidClips = this.currentPlaylistClips.filter(clip => !clip.audioBlob);
        if (invalidClips.length > 0) {
            return { 
                valid: false, 
                error: `Some clips are missing audio data: ${invalidClips.map(c => c.title).join(', ')}` 
            };
        }
        
        return { valid: true };
    }

    /**
     * Get available clips (not in current playlist)
     * @returns {Array} Available clips
     */
    getAvailableClips() {
        return this.allAvailableClips.filter(clip => 
            !this.currentPlaylistClips.some(c => c.id === clip.id)
        );
    }

    /**
     * Get current playlist data for finalization
     * @returns {Object} Playlist data ready for finalization
     */
    getFinalizationData() {
        return {
            clips: this.currentPlaylistClips,
            name: this.currentPlaylist?.name || 'Untitled Playlist',
            id: this.currentPlaylist?.id || null,
            audioClipIds: this.currentPlaylistClips.map(clip => clip.id)
        };
    }

    /**
     * Get playlist statistics
     * @returns {Object} Playlist stats
     */
    getPlaylistStats() {
        const totalDuration = this.currentPlaylistClips.reduce(
            (sum, clip) => sum + (clip.duration || 0), 0
        );
        
        const totalSize = this.currentPlaylistClips.reduce(
            (sum, clip) => sum + (clip.audioBlob?.size || 0), 0
        );
        
        return {
            clipCount: this.currentPlaylistClips.length,
            totalDuration: totalDuration,
            totalSize: totalSize,
            averageDuration: this.currentPlaylistClips.length > 0 ? totalDuration / this.currentPlaylistClips.length : 0
        };
    }

    /**
     * Format duration for display
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration
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
     * Refresh available clips from database
     */
    async refreshAvailableClips() {
        this.allAvailableClips = await this.db.getAllAudioClips();
        log(`Refreshed available clips: ${this.allAvailableClips.length} total`, 'info');
        this.notifyChange();
    }

    /**
     * Get current state
     * @returns {Object} Current service state
     */
    getState() {
        return {
            currentPlaylist: this.currentPlaylist,
            currentPlaylistClips: this.currentPlaylistClips,
            availableClips: this.getAvailableClips(),
            stats: this.getPlaylistStats()
        };
    }

    /**
     * Clear current playlist (start fresh)
     */
    clearPlaylist() {
        this.currentPlaylist = null;
        this.currentPlaylistClips = [];
        log('Playlist cleared - starting fresh', 'info');
        this.notifyChange();
    }

    /**
     * Notify components of state changes
     * @private
     */
    notifyChange() {
        eventBus.publish('playlist-state-changed', this.getState());
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.currentPlaylist = null;
        this.currentPlaylistClips = [];
        this.allAvailableClips = [];
    }
}
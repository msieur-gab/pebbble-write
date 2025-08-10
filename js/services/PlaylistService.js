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
     * Load playlist data by ID
     * @param {number|null} playlistId - Playlist ID or null for new playlist
     * @returns {Promise<Object>} Playlist data
     */
    async loadPlaylist(playlistId = null) {
        try {
            if (playlistId) {
                const playlist = await this.db.getPlaylistById(playlistId);
                this.currentPlaylist = playlist;
                this.currentPlaylistClips = await this.db.getAudioClipsForPlaylist(playlistId);
            } else {
                this.currentPlaylist = null;
                this.currentPlaylistClips = [];
            }

            // Always load available clips
            this.allAvailableClips = await this.db.getAllAudioClips();

            log(`Playlist loaded: ${playlistId ? `"${this.currentPlaylist.name}"` : 'new playlist'}`, 'info');
            
            return {
                playlist: this.currentPlaylist,
                clips: this.currentPlaylistClips,
                availableClips: this.getAvailableClips()
            };

        } catch (error) {
            log(`Failed to load playlist: ${error.message}`, 'error');
            throw new Error(`Could not load playlist: ${error.message}`);
        }
    }

    /**
     * Save playlist to database
     * @param {Object} playlistData - Playlist information
     * @returns {Promise<Object>} Saved playlist
     */
    async savePlaylist(playlistData) {
        try {
            const validation = this.validatePlaylist(playlistData);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const playlist = {
                name: playlistData.name.trim(),
                description: playlistData.description?.trim() || '',
                audioClipIds: this.currentPlaylistClips.map(clip => clip.id),
                timestamp: Date.now()
            };

            // Update existing or create new
            if (playlistData.id) {
                playlist.id = playlistData.id;
                await this.db.savePlaylist(playlist);
                this.currentPlaylist = playlist;
            } else {
                const newPlaylistId = await this.db.savePlaylist(playlist);
                this.currentPlaylist = { ...playlist, id: newPlaylistId };
            }

            log(`Playlist "${playlist.name}" saved successfully`, 'success');
            
            // Notify components of save
            eventBus.publish('playlist-saved', {
                playlist: this.currentPlaylist,
                clips: this.currentPlaylistClips
            });

            return this.currentPlaylist;

        } catch (error) {
            log(`Failed to save playlist: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Add audio clip to current playlist
     * @param {Object} clipData - Audio clip data with ID
     * @returns {Promise<void>}
     */
    async addClipToPlaylist(clipData) {
        try {
            // If we have an ID, fetch from DB to get complete data
            let clipToAdd;
            if (clipData.id && !clipData.audioBlob) {
                clipToAdd = await this.db.getAudioClip(clipData.id);
                if (!clipToAdd) {
                    throw new Error(`Clip with ID ${clipData.id} not found in database`);
                }
            } else {
                clipToAdd = clipData;
            }

            // Check if clip is already in playlist
            if (this.currentPlaylistClips.some(clip => clip.id === clipToAdd.id)) {
                log(`Clip "${clipToAdd.title}" is already in the playlist`, 'warning');
                return;
            }

            // Add to current playlist
            this.currentPlaylistClips.push(clipToAdd);

            // Update available clips if not already there
            if (!this.allAvailableClips.some(clip => clip.id === clipToAdd.id)) {
                this.allAvailableClips.push(clipToAdd);
            }

            log(`Added "${clipToAdd.title}" to playlist`, 'success');
            
            // Notify components of change
            eventBus.publish('playlist-updated', {
                action: 'clip-added',
                clip: clipToAdd,
                playlistClips: this.currentPlaylistClips,
                availableClips: this.getAvailableClips(),
                stats: this.getPlaylistStats()
            });

        } catch (error) {
            log(`Failed to add clip to playlist: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Remove clip from current playlist
     * @param {number} clipId - ID of clip to remove
     */
    removeClipFromPlaylist(clipId) {
        const clipIndex = this.currentPlaylistClips.findIndex(clip => clip.id === clipId);
        
        if (clipIndex === -1) {
            log(`Clip with ID ${clipId} not found in playlist`, 'warning');
            return;
        }

        const removedClip = this.currentPlaylistClips[clipIndex];
        this.currentPlaylistClips.splice(clipIndex, 1);

        log(`Removed "${removedClip.title}" from playlist`, 'info');
        
        // Notify components of change
        eventBus.publish('playlist-updated', {
            action: 'clip-removed',
            clip: removedClip,
            playlistClips: this.currentPlaylistClips,
            availableClips: this.getAvailableClips(),
            stats: this.getPlaylistStats()
        });
    }

    /**
     * Reorder clips in playlist
     * @param {Array} newOrder - Array of clip IDs in new order
     */
    reorderPlaylistClips(newOrder) {
        try {
            const reorderedClips = newOrder.map(clipId => {
                const clip = this.currentPlaylistClips.find(c => c.id === clipId);
                if (!clip) {
                    throw new Error(`Clip with ID ${clipId} not found`);
                }
                return clip;
            });

            this.currentPlaylistClips = reorderedClips;
            
            log('Playlist clips reordered', 'info');
            
            eventBus.publish('playlist-updated', {
                action: 'clips-reordered',
                playlistClips: this.currentPlaylistClips,
                stats: this.getPlaylistStats()
            });

        } catch (error) {
            log(`Failed to reorder clips: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get clips available to add to playlist (not already in it)
     * @returns {Array} Available clips
     */
    getAvailableClips() {
        return this.allAvailableClips.filter(clip => 
            !this.currentPlaylistClips.some(playlistClip => playlistClip.id === clip.id)
        );
    }

    /**
     * Get current playlist statistics
     * @returns {Object} Stats object
     */
    getPlaylistStats() {
        const totalClips = this.currentPlaylistClips.length;
        const totalDuration = this.currentPlaylistClips.reduce(
            (sum, clip) => sum + (clip.duration || 0), 
            0
        );

        return {
            clipCount: totalClips,
            totalDuration: totalDuration,
            formattedDuration: this.formatDuration(totalDuration),
            isEmpty: totalClips === 0
        };
    }

    /**
     * Validate playlist data
     * @param {Object} playlistData - Data to validate
     * @returns {Object} Validation result
     */
    validatePlaylist(playlistData) {
        if (!playlistData.name || playlistData.name.trim().length === 0) {
            return { valid: false, error: 'Playlist name is required' };
        }

        if (playlistData.name.trim().length > 100) {
            return { valid: false, error: 'Playlist name must be less than 100 characters' };
        }

        if (this.currentPlaylistClips.length === 0) {
            return { valid: false, error: 'Playlist must contain at least one audio clip' };
        }

        return { valid: true };
    }

    /**
     * Validate playlist for finalization
     * @returns {Object} Validation result
     */
    validateForFinalization() {
        if (!this.currentPlaylist || !this.currentPlaylist.name) {
            return { valid: false, error: 'Please set a playlist name before finalizing' };
        }

        if (this.currentPlaylistClips.length === 0) {
            return { valid: false, error: 'Cannot finalize an empty playlist. Please add some audio clips.' };
        }

        return { valid: true };
    }

    /**
     * Get playlist data ready for finalization
     * @returns {Object} Finalization data
     */
    getFinalizationData() {
        const validation = this.validateForFinalization();
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        return {
            clips: this.currentPlaylistClips,
            name: this.currentPlaylist.name,
            id: this.currentPlaylist?.id || null,
            description: this.currentPlaylist?.description || '',
            stats: this.getPlaylistStats()
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
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
        } else {
            return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
        }
    }

    /**
     * Refresh available clips from database
     */
    async refreshAvailableClips() {
        try {
            this.allAvailableClips = await this.db.getAllAudioClips();
            
            eventBus.publish('playlist-updated', {
                action: 'available-clips-refreshed',
                availableClips: this.getAvailableClips()
            });
            
        } catch (error) {
            log(`Failed to refresh available clips: ${error.message}`, 'error');
        }
    }

    /**
     * Clear current playlist data
     */
    clearPlaylist() {
        this.currentPlaylist = null;
        this.currentPlaylistClips = [];
        
        eventBus.publish('playlist-updated', {
            action: 'playlist-cleared',
            playlistClips: [],
            availableClips: this.getAvailableClips(),
            stats: this.getPlaylistStats()
        });
        
        log('Playlist cleared', 'info');
    }

    /**
     * Get current state
     * @returns {Object} Current state
     */
    getCurrentState() {
        return {
            playlist: this.currentPlaylist,
            clips: this.currentPlaylistClips,
            availableClips: this.getAvailableClips(),
            stats: this.getPlaylistStats()
        };
    }
}
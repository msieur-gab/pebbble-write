// js/services/FinalizationService.js
// Extracted playlist finalization business logic from playlistFinalization.js

import { log } from '../utils/log.js';
import { urlParser } from '../utils/urlParser.js';

export class FinalizationService {
    constructor(encryptionService, storageService, messageDb) {
        this.encryptionService = encryptionService;
        this.storageService = storageService;
        this.db = messageDb;
        
        // State for current finalization
        this.currentPlaylistData = null;
        this.currentTagSerial = null;
        this.isProcessing = false;
        this.progressCallback = null;
    }

    /**
     * Start the playlist finalization process
     * @param {Object} playlistData - Playlist data to finalize
     * @param {string} tagSerial - NFC tag serial number
     * @param {Function} onProgress - Progress callback function
     * @returns {Promise<Object>} Finalization result
     */
    async finalizePlaylist(playlistData, tagSerial, onProgress = () => {}) {
        // Validate inputs
        const validation = this.validateFinalizationInputs(playlistData, tagSerial);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Set up state
        this.currentPlaylistData = playlistData;
        this.currentTagSerial = tagSerial;
        this.isProcessing = true;
        this.progressCallback = onProgress;

        try {
            log(`Starting playlist finalization: "${playlistData.name}" with ${playlistData.clips.length} clips`, 'info');
            
            this.reportProgress({
                stage: 'starting',
                message: `Starting finalization for "${playlistData.name}"`,
                percentage: 0
            });

            // Create playlist manifest structure
            const playlistManifest = this.createPlaylistManifest(playlistData);

            // Process each audio clip
            const processedMessages = [];
            const totalClips = playlistData.clips.length;

            for (let i = 0; i < totalClips; i++) {
                const clip = playlistData.clips[i];
                
                this.reportProgress({
                    stage: 'processing-clip',
                    current: i + 1,
                    total: totalClips,
                    message: `Processing clip ${i + 1} of ${totalClips}: "${clip.title}"`,
                    percentage: Math.round((i / totalClips) * 80) // 80% for clips processing
                });

                try {
                    const processedMessage = await this.processAudioClip(clip, i + 1);
                    processedMessages.push(processedMessage);
                    playlistManifest.messages.push({
                        messageId: processedMessage.messageId,
                        ipfsHash: processedMessage.ipfsHash
                    });

                    log(`Successfully processed clip: "${clip.title}"`, 'success');

                } catch (error) {
                    log(`Failed to process clip "${clip.title}": ${error.message}`, 'error');
                    throw new Error(`Failed to process clip "${clip.title}": ${error.message}`);
                }
            }

            // Upload final manifest
            this.reportProgress({
                stage: 'uploading-manifest',
                message: 'All clips uploaded. Creating final playlist manifest...',
                percentage: 85
            });

            const finalManifestHash = await this.storageService.uploadMessagePackage(playlistManifest);
            const finalNfcUrl = urlParser.createSecureNfcUrl({ playlistHash: finalManifestHash });

            this.reportProgress({
                stage: 'saving-to-database',
                message: 'Saving finalized playlist to database...',
                percentage: 95
            });

            // Save to database
            try {
                await this.db.saveFinalizedPlaylist(
                    playlistData.name,
                    finalManifestHash,
                    tagSerial,
                    playlistData.clips.map(clip => clip.id)
                );
                log(`Playlist "${playlistData.name}" finalized and saved to database`, 'success');
            } catch (dbError) {
                log(`Failed to save finalized playlist to database: ${dbError.message}`, 'error');
                // Don't throw here - the playlist was successfully created, just not saved locally
            }

            // Create result
            const result = {
                success: true,
                url: finalNfcUrl,
                playlistHash: finalManifestHash,
                playlistName: playlistData.name,
                tagSerial: tagSerial,
                processedClips: processedMessages.length,
                totalClips: totalClips,
                processedMessages: processedMessages
            };

            this.reportProgress({
                stage: 'completed',
                message: 'Playlist finalization completed successfully!',
                percentage: 100,
                result: result
            });

            log('Playlist finalization completed successfully', 'success');
            return result;

        } catch (error) {
            this.reportProgress({
                stage: 'error',
                message: `Finalization failed: ${error.message}`,
                error: error
            });

            log(`Finalization failed: ${error.message}`, 'error');
            throw error;

        } finally {
            this.isProcessing = false;
            this.cleanup();
        }
    }

    /**
     * Process a single audio clip: encrypt and upload to IPFS
     * @private
     * @param {Object} clip - Audio clip data
     * @param {number} clipNumber - Sequential number for this clip
     * @returns {Promise<Object>} Processed message data
     */
    async processAudioClip(clip, clipNumber) {
        const timestamp = Date.now();
        
        try {
            // Generate encryption key
            const encryptionKey = await this.encryptionService.deriveEncryptionKey(
                this.currentTagSerial, 
                timestamp
            );
            
            // Convert audio blob to array buffer
            const audioBuffer = await clip.audioBlob.arrayBuffer();
            
            // Encrypt the audio data
            const encryptedAudio = await this.encryptionService.encryptDataToBinary(
                audioBuffer, 
                encryptionKey
            );
            
            // Create message package
            const messagePackage = {
                messageId: `PBB-${clip.id}-${timestamp}`,
                timestamp: timestamp,
                encryptedAudio: this.encryptionService.binToBase64(encryptedAudio),
                metadata: {
                    title: clip.title,
                    duration: clip.duration,
                    originalSize: audioBuffer.byteLength,
                    encryptedSize: encryptedAudio.length,
                    clipNumber: clipNumber
                }
            };
            
            // Upload to IPFS
            const ipfsHash = await this.storageService.uploadMessagePackage(messagePackage);
            
            return {
                messageId: messagePackage.messageId,
                ipfsHash: ipfsHash,
                title: clip.title,
                originalId: clip.id,
                encryptedSize: encryptedAudio.length,
                clipNumber: clipNumber
            };

        } catch (error) {
            log(`Error processing clip "${clip.title}": ${error.message}`, 'error');
            throw new Error(`Failed to encrypt/upload "${clip.title}": ${error.message}`);
        }
    }

    /**
     * Create the playlist manifest structure
     * @private
     * @param {Object} playlistData - Playlist data
     * @returns {Object} Playlist manifest
     */
    createPlaylistManifest(playlistData) {
        return {
            version: 'playlist-v1',
            messages: [], // Will be populated during processing
            metadata: {
                name: playlistData.name,
                description: playlistData.description || '',
                createdAt: Date.now(),
                totalClips: playlistData.clips.length,
                totalDuration: playlistData.stats?.totalDuration || 0,
                tagSerial: this.currentTagSerial
            }
        };
    }

    /**
     * Validate finalization inputs
     * @private
     * @param {Object} playlistData - Playlist data to validate
     * @param {string} tagSerial - Tag serial to validate
     * @returns {Object} Validation result
     */
    validateFinalizationInputs(playlistData, tagSerial) {
        if (!playlistData) {
            return { valid: false, error: 'No playlist data provided' };
        }

        if (!playlistData.name || playlistData.name.trim().length === 0) {
            return { valid: false, error: 'Playlist name is required' };
        }

        if (!playlistData.clips || playlistData.clips.length === 0) {
            return { valid: false, error: 'Cannot finalize an empty playlist. Please add some audio clips.' };
        }

        if (!tagSerial || tagSerial.trim().length === 0) {
            return { valid: false, error: 'Tag serial is required for encryption' };
        }

        if (!this.storageService) {
            return { valid: false, error: 'Storage service not available. Please check your API credentials.' };
        }

        if (!this.encryptionService) {
            return { valid: false, error: 'Encryption service not available' };
        }

        return { valid: true };
    }

    /**
     * Report progress to callback
     * @private
     * @param {Object} progressData - Progress information
     */
    reportProgress(progressData) {
        if (this.progressCallback) {
            try {
                this.progressCallback(progressData);
            } catch (error) {
                log(`Error in progress callback: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Estimate finalization time based on clip count
     * @param {number} clipCount - Number of clips to process
     * @returns {Object} Time estimation
     */
    estimateFinalizationTime(clipCount) {
        // Rough estimates based on typical performance
        const timePerClip = 3000; // 3 seconds per clip (encryption + upload)
        const manifestTime = 2000; // 2 seconds for final manifest
        
        const totalTime = (clipCount * timePerClip) + manifestTime;
        
        return {
            estimatedMs: totalTime,
            estimatedMinutes: Math.ceil(totalTime / 60000),
            perClipMs: timePerClip
        };
    }

    /**
     * Check if currently processing
     * @returns {boolean} True if processing
     */
    isCurrentlyProcessing() {
        return this.isProcessing;
    }

    /**
     * Get current processing status
     * @returns {Object|null} Current status or null if not processing
     */
    getCurrentStatus() {
        if (!this.isProcessing) {
            return null;
        }

        return {
            playlistName: this.currentPlaylistData?.name,
            tagSerial: this.currentTagSerial,
            totalClips: this.currentPlaylistData?.clips?.length || 0,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Cancel current finalization process
     * Note: This is a placeholder for future implementation
     * The current process cannot be easily cancelled due to encryption/upload operations
     */
    cancelFinalization() {
        log('Finalization cancellation requested - not yet implemented', 'warning');
        // TODO: Implement cancellation logic if needed
        // This would require making the process more granular and checking for cancellation flags
        
        return {
            success: false,
            message: 'Cancellation not yet supported. Please wait for current process to complete.'
        };
    }

    /**
     * Validate that all required services are available
     * @returns {Object} Validation result with any missing services
     */
    validateServices() {
        const missing = [];
        
        if (!this.encryptionService) missing.push('encryptionService');
        if (!this.storageService) missing.push('storageService');
        if (!this.db) missing.push('messageDb');
        
        return {
            isValid: missing.length === 0,
            missing: missing
        };
    }

    /**
     * Clean up resources and state
     * @private
     */
    cleanup() {
        this.currentPlaylistData = null;
        this.currentTagSerial = null;
        this.progressCallback = null;
        // Note: Don't set isProcessing to false here, it's set in the finally block
    }

    /**
     * Reset service state
     */
    reset() {
        this.isProcessing = false;
        this.cleanup();
        log('FinalizationService reset', 'info');
    }
}
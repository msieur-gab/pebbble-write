// components/writerApp.js

import { log } from '../utils/log.js';
import { urlParser } from '../utils/urlParser.js';
import { eventBus } from '../services/eventBus.js';
import { EncryptionService } from '../services/encryptionService.js';
import { StorageService } from '../services/storageService.js';
import { MessageDb } from '../services/messageDb.js';
import { NFCService } from '../services/nfcService.js';

import './apiSetupForm.js';
import './fabComponent.js';
import './serialModal.js';
import './playlistView.js';
import './playlistCreationView.js';

class WriterApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.db = new MessageDb();
        this.encryptionService = new EncryptionService();
        this.nfcService = new NFCService();
        this.storageService = null;
        this.currentTagSerial = null;
        this.currentPlaylistId = null;

        this.render();
        this.loadState();
        this.setupEventListeners();
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                .hidden { display: none; }
                .flex { display: flex; }
                .flex-col { flex-direction: column; }
                .justify-center { justify-content: center; }
                .items-center { align-items: center; }
                .space-x-4 > * + * { margin-left: 1rem; }
                .space-y-4 > * + * { margin-top: 1rem; }
                .mb-8 { margin-bottom: 2rem; }
                .my-6 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
                .text-center { text-align: center; }
                .text-gray-400 { color: #9ca3af; }
                .italic { font-style: italic; }
                .btn { padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 0.5rem; cursor: pointer; border: none; transition: background-color 0.3s ease; }
                .btn-primary { background-color: var(--primary-color); color: #ffffff; }
                .btn-primary:hover { background-color: var(--button-hover); }
                .btn-secondary { background-color: #e5e7eb; color: #1f2937; }
                .btn-secondary:hover { background-color: #d1d5db; }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .status-box { padding: 1rem; border-radius: 0.5rem; font-size: 0.875rem; margin-bottom: 1.5rem; }
                .status-box.warning { background-color: #fffbeb; border: 1px solid #fcd34d; color: #92400e; }
                .form-input { width: 100%; padding: 0.75rem; border: 2px solid #d1d5db; border-radius: 0.5rem; transition: border-color 0.3s ease; }
                .form-input:focus { outline: none; border-color: var(--primary-color); }
                .recording-btn { width: 6rem; height: 6rem; border-radius: 9999px; background-color: var(--accent-color); color: #ffffff; font-size: 1.875rem; display: flex; align-items: center; justify-content: center; margin: auto; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.5); transition: all 0.2s ease; }
                .recording-btn:hover { transform: scale(1.1); }
                .recording-btn.pulse { animation: pulse 1.5s infinite; }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
                .playlist-item { background-color: #f9fafb; padding: 0.75rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
                .log-container { margin-top: 2rem; background-color: var(--log-bg); color: var(--log-text); border-radius: 0.5rem; padding: 1rem; max-height: 10rem; overflow-y: auto; }
            </style>
            <div id="apiSetupForm">
                <div class="status-box warning">
                    <p><span class="font-bold">Note:</span> This app writes messages to a simulated NFC tag. A real app would use the Web NFC API.</p>
                </div>
                <h3>Pinata IPFS Credentials</h3>
                <div class="flex flex-col space-y-4">
                    <input type="text" id="pinata-api-key" placeholder="Pinata API Key" class="form-input">
                    <input type="password" id="pinata-secret" placeholder="Pinata Secret API Key" class="form-input">
                    <button id="set-credentials-btn" class="btn btn-primary">Set Credentials</button>
                </div>
            </div>
            
            <div id="mainApp" class="hidden">
                <playlist-view class="hidden"></playlist-view>
                <playlist-creation-view class="hidden"></playlist-creation-view>
            </div>

            <div id="writerResults" class="hidden">
                <h3>Playlist Saved!</h3>
                <p class="text-gray-500">Tap a blank Pebbble to write the URL:</p>
                <div class="mt-4 flex space-x-4 items-center">
                    <pre id="nfc-url-display" class="flex-grow"></pre>
                    <button id="write-nfc-btn" class="btn btn-primary">Write to NFC Tag</button>
                </div>
                <button id="backToPlaylistsBtn" class="btn btn-secondary">Back to Playlists</button>
            </div>
            
            <fab-component class="hidden"></fab-component>
            <serial-modal class="hidden"></serial-modal>
        `;
    }

    async loadState() {
        const apiKey = (await this.db.getSetting('apiKey'))?.value || '';
        const secret = (await this.db.getSetting('secret'))?.value || '';

        if (apiKey && secret) {
            this.storageService = new StorageService(apiKey, secret);
            this.shadowRoot.querySelector('#pinata-api-key').value = apiKey;
            this.shadowRoot.querySelector('#pinata-secret').value = secret;
            this.showStep('playlistView');
        } else {
            this.showStep('apiSetupForm');
        }
    }
    
    showStep(stepId) {
        const sections = ['apiSetupForm', 'writerResults'];
        sections.forEach(id => {
            const el = this.shadowRoot.querySelector(`#${id}`);
            if (el) el.classList.add('hidden');
        });
        
        const mainAppContainer = this.shadowRoot.querySelector('#mainApp');
        const playlistView = this.shadowRoot.querySelector('playlist-view');
        const playlistCreationView = this.shadowRoot.querySelector('playlist-creation-view');
        const fab = this.shadowRoot.querySelector('fab-component');
        const serialModal = this.shadowRoot.querySelector('serial-modal');

        mainAppContainer.classList.add('hidden');
        playlistView.classList.add('hidden');
        playlistCreationView.classList.add('hidden');
        fab.classList.add('hidden');
        serialModal.classList.add('hidden');
        
        switch(stepId) {
            case 'apiSetupForm':
                this.shadowRoot.querySelector(`#${stepId}`).classList.remove('hidden');
                break;
            case 'playlistView':
                mainAppContainer.classList.remove('hidden');
                playlistView.classList.remove('hidden');
                fab.classList.remove('hidden');
                break;
            case 'playlistCreationView':
                mainAppContainer.classList.remove('hidden');
                playlistCreationView.classList.remove('hidden');
                break;
            case 'writerResults':
                this.shadowRoot.querySelector(`#${stepId}`).classList.remove('hidden');
                break;
            case 'serialModal':
                serialModal.classList.remove('hidden');
                break;
        }
    }

    setupEventListeners() {
        this.shadowRoot.querySelector('#set-credentials-btn').addEventListener('click', async () => {
            const apiKey = this.shadowRoot.querySelector('#pinata-api-key').value.trim();
            const secret = this.shadowRoot.querySelector('#pinata-secret').value.trim();
            if (apiKey && secret) {
                this.storageService = new StorageService(apiKey, secret);
                await this.db.saveSetting('apiKey', apiKey);
                await this.db.saveSetting('secret', secret);
                this.showStep('playlistView');
                log('Pinata credentials set. Ready to create your playlist.', 'success');
            } else {
                log('Please fill in all fields.', 'warning');
            }
        });

        eventBus.subscribe('fab-clicked', () => {
            this.currentPlaylistId = null;
            this.showStep('playlistCreationView');
            this.shadowRoot.querySelector('playlist-creation-view').setPlaylistData(null);
            log('Starting a new playlist.', 'info');
        });
        
        eventBus.subscribe('open-playlist', (data) => {
            this.currentPlaylistId = data.playlist.id;
            this.showStep('playlistCreationView');
            this.shadowRoot.querySelector('playlist-creation-view').setPlaylistData(data.playlist);
            log(`Opening playlist "${data.playlist.name}".`, 'info');
        });

        eventBus.subscribe('save-playlist-requested', (data) => this.savePlaylist(data));
        eventBus.subscribe('back-to-playlists', () => this.showStep('playlistView'));
        eventBus.subscribe('finalize-playlist-requested', () => this.showStep('serialModal'));
        eventBus.subscribe('modal-close', () => this.showStep('playlistCreationView'));
        eventBus.subscribe('scan-serial-request', () => this.handleScanRequest());
        eventBus.subscribe('manual-serial-set', (serial) => this.handleManualSerialSet(serial));
        
        this.shadowRoot.querySelector('#write-nfc-btn').addEventListener('click', () => this.writeNfcUrl());
        this.shadowRoot.querySelector('#backToPlaylistsBtn').addEventListener('click', () => this.showStep('playlistView'));
    }

    showSerialModal() {
        this.shadowRoot.querySelector('serial-modal').style.display = 'flex';
    }
    
    hideSerialModal() {
        this.shadowRoot.querySelector('serial-modal').style.display = 'none';
        this.shadowRoot.querySelector('serial-modal').shadowRoot.querySelector('#modal-manual-serial-input').value = '';
    }
    
    async savePlaylist(data) {
        const playlistToSave = {
            name: data.name,
            description: data.description,
            audioClipIds: data.audioClipIds,
            timestamp: Date.now()
        };

        if (data.id) {
            playlistToSave.id = data.id;
            await this.db.savePlaylist(playlistToSave);
            log(`Playlist "${data.name}" updated.`, 'success');
        } else {
            await this.db.savePlaylist(playlistToSave);
            log(`New playlist "${data.name}" saved.`, 'success');
        }

        this.showStep('playlistView');
        this.shadowRoot.querySelector('playlist-view').loadPlaylists();
        log('Playlist successfully saved to history.', 'success');
    }
    
    async handleScanRequest() {
        this.hideSerialModal();
        try {
            await this.nfcService.startReader((serial) => {
                if (serial) {
                    this.currentTagSerial = serial;
                    this.finalizeAndWritePlaylist();
                    this.nfcService.stopReader();
                } else {
                    log('No serial number found on the tag.', 'warning');
                }
            });
        } catch (e) { log(`NFC scan failed: ${e.message}`, 'error'); }
    }
    
    handleManualSerialSet(serial) {
        this.currentTagSerial = serial;
        this.finalizeAndWritePlaylist();
    }
    
    async finalizeAndWritePlaylist() {
        const currentPlaylistView = this.shadowRoot.querySelector('playlist-creation-view');
        const playlistClips = currentPlaylistView.currentPlaylistClips;
        
        if (playlistClips.length === 0) {
            log('No clips in the playlist to finalize.', 'warning');
            this.hideSerialModal();
            return;
        }

        log(`Finalizing playlist "${currentPlaylistView.shadowRoot.querySelector('#playlistTitle').value}" with ${playlistClips.length} clips.`, 'info');
        log('Clips to be uploaded:');
        playlistClips.forEach(clip => {
            log(`- ID: ${clip.id}, Title: "${clip.title}"`);
        });

        this.hideSerialModal();
        const fabBtn = this.shadowRoot.querySelector('fab-component');
        if (fabBtn) {
            fabBtn.disabled = true;
        }

        const playlistManifest = { version: 'playlist-v1', messages: [] };
        
        for (const message of playlistClips) {
            try {
                const timestamp = Date.now();
                const encryptionKey = await this.encryptionService.deriveEncryptionKey(this.currentTagSerial, timestamp);
                const audioBuffer = await message.audioBlob.arrayBuffer();
                const encryptedAudio = await this.encryptionService.encryptDataToBinary(audioBuffer, encryptionKey);
                
                const messagePackage = {
                    messageId: `PBB-${message.id}`,
                    timestamp: timestamp,
                    encryptedAudio: this.encryptionService.binToBase64(encryptedAudio),
                    metadata: { title: message.title }
                };
                const ipfsHash = await this.storageService.uploadMessagePackage(messagePackage);
                playlistManifest.messages.push({ messageId: messagePackage.messageId, ipfsHash: ipfsHash });
                log(`Uploaded clip "${message.title}" (ID: ${message.id})`, 'success');
            } catch (err) {
                log(`Failed to process message "${message.title}": ${err.message}`, 'error');
            }
        }

        if (playlistManifest.messages.length > 0) {
            const finalManifestHash = await this.storageService.uploadMessagePackage(playlistManifest);
            const finalNfcUrl = urlParser.createSecureNfcUrl({ playlistHash: finalManifestHash });
            
            const playlist = await this.db.db.finalizedPlaylists.get(this.currentPlaylistId);
            if (playlist) {
                await this.db.db.finalizedPlaylists.update(this.currentPlaylistId, {
                    playlistHash: finalManifestHash,
                    tagSerial: this.currentTagSerial
                });
                log(`Playlist "${playlist.name}" finalized and saved.`, 'success');
            }

            this.showStep('writerResults');
            this.shadowRoot.querySelector('#nfc-url-display').textContent = finalNfcUrl;
            log('Playlist successfully uploaded and URL generated!', 'success');
        
            this.writeNfcUrl(finalNfcUrl);
        } else {
            log('No clips were successfully processed, cannot finalize playlist.', 'error');
            this.showStep('playlistCreationView');
        }

        if (fabBtn) {
            fabBtn.disabled = false;
        }
    }
    
    async writeNfcUrl(url) {
        const writeNfcBtn = this.shadowRoot.querySelector('#write-nfc-btn');
        writeNfcBtn.disabled = true;
        writeNfcBtn.textContent = 'Tap Tag to Verify & Write...';
        
        try {
            await this.nfcService.startReader(async (scannedSerial) => {
                this.nfcService.stopReader();
                if (scannedSerial === this.currentTagSerial) {
                    log('Serial match confirmed. Writing URL to tag.', 'success');
                    await this.nfcService.writeUrl(url);
                    writeNfcBtn.textContent = 'Write Successful!';
                } else {
                    log(`SECURITY ERROR: Scanned serial "${scannedSerial}" does not match original serial "${this.currentTagSerial}".`, 'error');
                    writeNfcBtn.textContent = 'Serial Mismatch - Try Again';
                    writeNfcBtn.disabled = false;
                }
            });
        } catch (e) {
            log(`NFC scan/write failed: ${e.message}`, 'error');
            writeNfcBtn.textContent = 'Write Failed';
            writeNfcBtn.disabled = false;
        }
    }
}
customElements.define('app-writer', WriterApp);
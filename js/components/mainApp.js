// js/components/mainApp.js

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';
import { appState } from '../services/appState.js';
import { MessageDb } from '../services/messageDb.js';
import { StorageService } from '../services/storageService.js';

// Import all components
import './apiSetupForm.js';
import './homeView.js';
import './playlistsView.js'; 
import './playlistCreator.js';      
import './audioCreator.js';         // Renamed from audioManagement.js
import './playlistFinalization.js';  // New
import './writerResults.js';         // New
import './serialModal.js';           // Updated
import './ui/toast.js';
import './ui/fab.js';

class MainApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Services
        this.db = new MessageDb();
        this.storageService = null;
        
        this.render();
        this.setupEventHandlers();
        this.setupStateSubscriptions();
        this.initializeApp();
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; width: 100%; }
                .view { min-height: 400px; }
                .hidden { display: none !important; }
            </style>
            
            <!-- API Setup -->
            <div id="apiSetupForm" class="view hidden">
                <api-setup-form></api-setup-form>
            </div>
            
            <!-- Main App Views -->
            <div id="mainAppContainer" class="view hidden">
                <home-view class="view hidden" id="homeView"></home-view>
                <playlist-creator class="view hidden" id="playlistCreator"></playlist-creator>
                <audio-creator class="view hidden" id="audioCreator"></audio-creator>
                <playlist-finalization class="view hidden" id="playlistFinalization"></playlist-finalization>
            </div>
            
            <!-- Global Components -->
            <toast-component></toast-component>
            <fab-component></fab-component>
            <serial-modal></serial-modal>
        `;
    }

    setupEventHandlers() {
        // API Setup
        eventBus.subscribe('credentials-set', (data) => {
            this.handleCredentialsSet(data);
        });
        
        // Navigation events
        eventBus.subscribe('new-playlist-requested', () => {
            appState.navigateTo('playlistCreator');
            // Will be set up in setupViewData
        });
        
        eventBus.subscribe('new-recording-requested', () => {
            appState.navigateTo('audioCreator');
        });
        
        eventBus.subscribe('back-to-home', () => {
            appState.navigateTo('homeView');
        });

        eventBus.subscribe('open-playlist', (data) => {
            appState.set('pendingPlaylistData', data.playlist);
            appState.navigateTo('playlistCreator');
            // Will be set up in setupViewData
        });

        // Playlist operations
        eventBus.subscribe('save-playlist-requested', (data) => {
            this.handleSavePlaylist(data);
        });
        
        eventBus.subscribe('finalize-playlist-requested', () => {
            this.handleFinalizationRequest();
        });

        // Modal events
        eventBus.subscribe('show-serial-modal', () => {
            appState.navigateTo('serialModal');
        });

        eventBus.subscribe('hide-serial-modal', () => {
            // Return to where we were (usually finalization)
            if (appState.get('currentView') === 'serialModal') {
                appState.navigateTo('playlistFinalization');
            }
        });

        eventBus.subscribe('modal-close', () => {
            // User cancelled, go back to playlist creator
            appState.navigateTo('playlistCreator');
        });
    }

    setupStateSubscriptions() {
        // React to state changes
        appState.subscribe('currentView', (newView) => {
            this.switchToView(newView);
        });
        
        appState.subscribe('apiCredentials', (credentials) => {
            if (credentials.isSet) {
                this.storageService = new StorageService(credentials.key, credentials.secret);
                log('Storage service initialized with credentials', 'success');
            }
        });
    }

    async initializeApp() {
        try {
            // Check for existing credentials
            const apiKey = (await this.db.getSetting('apiKey'))?.value;
            const secret = (await this.db.getSetting('secret'))?.value;

            if (apiKey && secret) {
                appState.setCredentials(apiKey, secret);
                appState.update({
                    currentView: 'homeView',
                    showFab: true
                });
            } else {
                appState.set('currentView', 'apiSetupForm');
            }
            
            log('MainApp initialized successfully', 'success');
        } catch (error) {
            log('Failed to initialize MainApp', 'error');
            appState.set('currentView', 'apiSetupForm');
        }
    }

    switchToView(viewName) {
        // Hide all views first
        const views = this.shadowRoot.querySelectorAll('.view');
        views.forEach(view => view.classList.add('hidden'));
        
        const mainContainer = this.shadowRoot.querySelector('#mainAppContainer');
        const serialModal = this.shadowRoot.querySelector('serial-modal');
        
        // Handle special cases first
        if (viewName === 'serialModal') {
            serialModal.shadowRoot.querySelector('modal-component').open();
            return;
        } else {
            serialModal.shadowRoot.querySelector('modal-component').close();
        }
        
        // Handle main views
        let targetView = null;
        
        switch(viewName) {
            case 'apiSetupForm':
                targetView = this.shadowRoot.querySelector('#apiSetupForm');
                break;
                
            case 'homeView':
            case 'playlistCreator':
            case 'audioCreator':
            case 'playlistFinalization':
                mainContainer.classList.remove('hidden');
                targetView = this.shadowRoot.querySelector(`#${viewName}`);
                break;
                
            default:
                log(`Unknown view: ${viewName}`, 'warning');
                return;
        }
        
        if (targetView) {
            targetView.classList.remove('hidden');
            log(`Switched to view: ${viewName}`, 'info');
            
            // Handle view-specific setup
            this.setupViewData(viewName, targetView);
        }
    }

    setupViewData(viewName, viewElement) {
        // Set up data for views that need it
        switch(viewName) {
            case 'homeView':
                // Refresh playlists when returning home
                const playlistsView = viewElement.shadowRoot?.querySelector('playlists-view');
                if (playlistsView) {
                    playlistsView.loadPlaylists();
                }
                break;
                
            case 'playlistCreator':
                // Initialize playlist creator with data (null for new, or existing playlist)
                const pendingData = appState.get('pendingPlaylistData');
                viewElement.setPlaylistData(pendingData || null);
                
                // Clear the pending data
                appState.set('pendingPlaylistData', null);
                
                if (pendingData) {
                    log(`Opening playlist "${pendingData.name}" for editing.`, 'info');
                } else {
                    log('Starting a new playlist.', 'info');
                }
                break;
        }
    }

    // Event Handlers
    async handleCredentialsSet({ apiKey, secret }) {
        try {
            await this.db.saveSetting('apiKey', apiKey);
            await this.db.saveSetting('secret', secret);
            
            appState.setCredentials(apiKey, secret);
            appState.update({
                currentView: 'homeView',
                showFab: true
            });
            
            appState.showToast('Credentials saved successfully!', 'success');
        } catch (error) {
            log('Failed to save credentials', 'error');
            appState.showToast('Failed to save credentials', 'error');
        }
    }

    async handleSavePlaylist(playlistData) {
        try {
            // For new playlists, don't include id field at all
            const playlist = {
                name: playlistData.name,
                description: playlistData.description,
                audioClipIds: playlistData.audioClipIds,
                timestamp: Date.now()
            };

            // Only add id if it's a valid existing playlist
            if (playlistData.id) {
                playlist.id = playlistData.id;
            }

            await this.db.savePlaylist(playlist);

            appState.update({
                currentView: 'homeView'
            });
            
            appState.showToast('Playlist saved!', 'success');
        } catch (error) {
            log(`Failed to save playlist: ${error.message}`, 'error');
            appState.showToast('Failed to save playlist', 'error');
        }
    }

    async handleFinalizationRequest() {
        // Get current playlist data from playlist creator
        const playlistCreator = this.shadowRoot.querySelector('#playlistCreator');
        
        const playlistData = {
            clips: playlistCreator.currentPlaylistClips,
            name: playlistCreator.shadowRoot.querySelector('#playlistTitle').value,
            id: playlistCreator.currentPlaylistId
        };

        // Switch to finalization view
        appState.navigateTo('playlistFinalization');
        
        // Start finalization process
        const finalizationComponent = this.shadowRoot.querySelector('#playlistFinalization');
        finalizationComponent.reset();
        finalizationComponent.startFinalization(playlistData, this.storageService);
    }
}

customElements.define('main-app', MainApp);
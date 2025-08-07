// js/components/homeView.js - Updated with Audio Library access

import { eventBus } from '../services/eventBus.js';
import { log } from '../utils/log.js';
import './playlistsView.js';
import './ui/fab.js';

class HomeViewComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupEventListeners();
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .container { padding: 1rem; text-align: center; }
                .btn { 
                    padding: 0.75rem 1.5rem; 
                    font-weight: 700; 
                    border-radius: 0.5rem; 
                    cursor: pointer; 
                    border: none; 
                    transition: background-color 0.3s ease;
                    margin: 0.5rem;
                }
                .btn-primary { 
                    background-color: var(--primary-color); 
                    color: #ffffff; 
                }
                .btn-secondary { 
                    background-color: #e5e7eb; 
                    color: #1f2937; 
                }
                .btn-outline {
                    background-color: transparent;
                    color: var(--primary-color);
                    border: 2px solid var(--primary-color);
                }
                .btn:hover.btn-primary { background-color: var(--button-hover); }
                .btn:hover.btn-secondary { background-color: #d1d5db; }
                .btn:hover.btn-outline { 
                    background-color: var(--primary-color); 
                    color: white; 
                }
                .space-y-4 > * + * { margin-top: 1rem; }
                .action-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                    margin: 2rem 0;
                }
                .action-card {
                    background: #f9fafb;
                    border: 2px solid #e5e7eb;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    text-align: center;
                    transition: all 0.3s ease;
                    cursor: pointer;
                }
                .action-card:hover {
                    border-color: var(--primary-color);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }
                .action-card h3 {
                    margin: 0 0 0.5rem 0;
                    color: #374151;
                }
                .action-card p {
                    margin: 0;
                    color: var(--secondary-color);
                    font-size: 0.875rem;
                }
                .action-icon {
                    font-size: 2rem;
                    margin-bottom: 1rem;
                }
            </style>
            <div class="container space-y-4">
                <h2>Welcome to Pebbble Writer</h2>
                <p>What would you like to do?</p>
                
                <div class="action-grid">
                    <div class="action-card" id="new-playlist-card">
                        <div class="action-icon">📋</div>
                        <h3>Create Playlist</h3>
                        <p>Build a new playlist with voice recordings and music</p>
                    </div>
                    
                    <div class="action-card" id="new-recording-card">
                        <div class="action-icon">🎤</div>
                        <h3>Record Audio</h3>
                        <p>Create a new voice recording or upload music</p>
                    </div>
                    
                    <div class="action-card" id="audio-library-card">
                        <div class="action-icon">🎵</div>
                        <h3>Audio Library</h3>
                        <p>Manage and organize all your audio clips</p>
                    </div>
                </div>
                
                <div class="mt-4">
                    <playlists-view></playlists-view>
                </div>
            </div>
            <fab-component></fab-component>
        `;
    }

    setupEventListeners() {
        // Action cards
        this.shadowRoot.querySelector('#new-playlist-card').addEventListener('click', () => {
            log('Creating a new playlist...', 'info');
            eventBus.publish('new-playlist-requested');
        });
        
        this.shadowRoot.querySelector('#new-recording-card').addEventListener('click', () => {
            log('Creating a new recording...', 'info');
            eventBus.publish('new-recording-requested');
        });
        
        // NEW: Audio library access
        this.shadowRoot.querySelector('#audio-library-card').addEventListener('click', () => {
            log('Opening audio library...', 'info');
            eventBus.publish('open-audio-library');
        });
    }
}

customElements.define('home-view', HomeViewComponent);
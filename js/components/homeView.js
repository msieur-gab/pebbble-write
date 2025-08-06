// components/homeView.js

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
                .btn { padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 0.5rem; cursor: pointer; border: none; transition: background-color 0.3s ease; }
                .btn-primary { background-color: var(--primary-color); color: #ffffff; }
                .btn-secondary { background-color: #e5e7eb; color: #1f2937; }
                .space-y-4 > * + * { margin-top: 1rem; }
            </style>
            <div class="container space-y-4">
                <h2>Welcome to Pebbble Writer</h2>
                <p>What would you like to do?</p>
                <button id="new-playlist-btn" class="btn btn-primary">Create a New Playlist</button>
                <button id="new-recording-btn" class="btn btn-secondary">Create a New Recording</button>
                <div class="mt-4">
                    <playlists-view></playlists-view>
                </div>
            </div>
            <fab-component></fab-component>
        `;
    }

    setupEventListeners() {
        this.shadowRoot.querySelector('#new-playlist-btn').addEventListener('click', () => {
            log('Creating a new playlist...', 'info');
            eventBus.publish('new-playlist-requested');
        });
        
        this.shadowRoot.querySelector('#new-recording-btn').addEventListener('click', () => {
            log('Creating a new recording...', 'info');
            eventBus.publish('new-recording-requested');
        });
    }
}
customElements.define('home-view', HomeViewComponent);
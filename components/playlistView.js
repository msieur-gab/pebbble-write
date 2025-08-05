// components/playlistView.js

import { log } from '../utils/log.js';
import { eventBus } from '../services/eventBus.js';
import { MessageDb } from '../services/messageDb.js';

class PlaylistView extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.db = new MessageDb();

        this.render();
        this.loadPlaylists();
        this.setupEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                .playlist-manager-container {
                    padding: 1rem;
                }
                .playlist-item {
                    background-color: #f9fafb;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                    margin-bottom: 0.5rem;
                }
                .playlist-item button {
                    cursor: pointer;
                    background: none;
                    border: none;
                    color: var(--primary-color);
                    font-weight: bold;
                    margin-left: 1rem;
                }
                .playlist-item button.delete {
                    color: var(--accent-color);
                }
                .playlist-card-container {
                    display: flex;
                    gap: 1rem;
                    overflow-x: auto;
                    padding-bottom: 1rem;
                    margin-top: 1rem;
                }
                .playlist-item-card {
                    background-color: #eef2ff;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                    min-width: 150px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .playlist-item-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                .no-playlists-message {
                    text-align: center;
                    font-style: italic;
                    color: var(--secondary-color);
                    margin-top: 2rem;
                }
            </style>
            <div class="playlist-manager-container">
                <h3>Saved Playlists</h3>
                <div id="saved-playlists-container" class="playlist-card-container"></div>
                <p id="no-playlists-message" class="hidden">I have not created any playlist yet. Start creating a new playlist.</p>
            </div>
        `;
    }

    setupEventListeners() {
        this.shadowRoot.querySelector('#saved-playlists-container').addEventListener('click', async (event) => {
            if (event.target.closest('.playlist-item-card')) {
                const playlistId = event.target.closest('.playlist-item-card').dataset.id;
                const playlist = await this.db.getPlaylistById(playlistId);
                eventBus.publish('open-playlist', { playlist });
            }
        });
    }

    async loadPlaylists() {
        const playlists = await this.db.getPlaylists();
        const container = this.shadowRoot.querySelector('#saved-playlists-container');
        const noPlaylistsMessage = this.shadowRoot.querySelector('#no-playlists-message');
        
        container.innerHTML = '';
        if (playlists.length === 0) {
            noPlaylistsMessage.classList.remove('hidden');
        } else {
            noPlaylistsMessage.classList.add('hidden');
            playlists.forEach(p => {
                const card = document.createElement('div');
                card.className = 'playlist-item-card';
                card.dataset.id = p.id;
                card.innerHTML = `
                    <h4>${p.name}</h4>
                    <p>${new Date(p.timestamp).toLocaleDateString()}</p>
                `;
                container.appendChild(card);
            });
        }
    }
}
customElements.define('playlist-view', PlaylistView);
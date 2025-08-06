// components/ui/fab.js

import { eventBus } from '../../services/eventBus.js';
import { stateManager } from '../../services/stateManager.js';

class FabComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isMenuOpen = false;
        this.render();
        this.setupEventListeners();
        this.setupStateSubscription();
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    z-index: 10;
                    display: none; /* The FAB is now hidden by default */
                }
                .fab-menu-container {
                    display: none;
                    flex-direction: column-reverse;
                    align-items: flex-end;
                    transition: all 0.3s ease;
                }
                .fab-menu-container.open {
                    display: flex;
                }
                .fab-btn {
                    width: 4rem;
                    height: 4rem;
                    border-radius: 9999px;
                    background-color: var(--primary-color);
                    color: white;
                    font-size: 2.5rem;
                    line-height: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s ease;
                    margin-top: 1rem;
                }
                .fab-btn:hover {
                    transform: scale(1.1);
                }
                .menu-option {
                    font-size: 1rem;
                    padding: 0.5rem 1rem;
                    color: #fff;
                    background-color: var(--secondary-color);
                    border-radius: 0.5rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    margin-bottom: 0.5rem;
                    display: none;
                    opacity: 0;
                    transform: translateX(20px);
                    transition: all 0.3s ease;
                    pointer-events: none;
                }
                .menu-option.visible {
                    display: block;
                    opacity: 1;
                    transform: translateX(0);
                    pointer-events: auto;
                }
                .main-fab {
                    background-color: var(--primary-color);
                }
            </style>
            <div class="fab-menu-container" id="fab-menu-container">
                <button class="btn menu-option" id="new-recording-btn">New Recording</button>
                <button class="btn menu-option" id="new-playlist-btn">New Playlist</button>
                <button class="fab-btn main-fab" id="main-fab">+</button>
            </div>
        `;
    }
    
    setupEventListeners() {
        const mainFab = this.shadowRoot.querySelector('#main-fab');
        const newRecordingBtn = this.shadowRoot.querySelector('#new-recording-btn');
        const newPlaylistBtn = this.shadowRoot.querySelector('#new-playlist-btn');

        mainFab.addEventListener('click', () => {
            this.toggleMenu();
        });

        newRecordingBtn.addEventListener('click', () => {
            eventBus.publish('new-recording-requested');
            this.toggleMenu();
        });
        
        newPlaylistBtn.addEventListener('click', () => {
            eventBus.publish('new-playlist-requested');
            this.toggleMenu();
        });
    }

    setupStateSubscription() {
        eventBus.subscribe('app-view-changed', (newView) => {
            const container = this.shadowRoot.querySelector('#fab-menu-container');
            if (newView === 'homeView') {
                container.style.display = 'flex';
                this.style.display = 'block';
            } else {
                container.style.display = 'none';
                this.isMenuOpen = false;
                this.toggleMenu(false);
                this.style.display = 'none';
            }
        });
    }

    toggleMenu(forceState = null) {
        this.isMenuOpen = forceState !== null ? forceState : !this.isMenuOpen;
        const container = this.shadowRoot.querySelector('#fab-menu-container');
        const options = this.shadowRoot.querySelectorAll('.menu-option');

        if (this.isMenuOpen) {
            container.classList.add('open');
            options.forEach(option => option.classList.add('visible'));
            this.shadowRoot.querySelector('#main-fab').textContent = '×';
        } else {
            container.classList.remove('open');
            options.forEach(option => option.classList.remove('visible'));
            this.shadowRoot.querySelector('#main-fab').textContent = '+';
        }
    }
}
customElements.define('fab-component', FabComponent);
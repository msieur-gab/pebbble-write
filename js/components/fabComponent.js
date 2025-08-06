// components/fabComponent.js

import { eventBus } from '../services/eventBus.js';

class FabComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .fab-btn {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
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
                    z-index: 10;
                }
                
                .fab-btn:hover {
                    transform: scale(1.1);
                }
            </style>
            <button class="fab-btn">+</button>
        `;
    }
    
    setupEventListeners() {
        this.shadowRoot.querySelector('.fab-btn').addEventListener('click', () => {
            eventBus.publish('fab-clicked');
        });
    }
}
customElements.define('fab-component', FabComponent);
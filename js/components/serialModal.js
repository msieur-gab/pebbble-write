// components/serialModal.js

import { eventBus } from '../services/eventBus.js';
import { log } from '../utils/log.js';

class SerialModal extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 20;
                }
                
                .modal-content {
                    background-color: white;
                    padding: 2rem;
                    border-radius: 1rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                    width: 90%;
                    max-width: 400px;
                }
                
                .text-center { text-align: center; }
                .space-y-4 > * + * { margin-top: 1rem; }
                .my-6 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
                
                .btn { padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 0.5rem; cursor: pointer; border: none; transition: background-color 0.3s ease; }
                .btn-primary { background-color: var(--primary-color); color: #ffffff; }
                .btn-primary:hover { background-color: var(--button-hover); }
                .btn-secondary { background-color: #e5e7eb; color: #1f2937; }
                .btn-secondary:hover { background-color: #d1d5db; }
                .btn:disabled { opacity: 0.6; cursor: not-allowed; }
                
                .form-input { width: 100%; padding: 0.75rem; border: 2px solid #d1d5db; border-radius: 0.5rem; transition: border-color 0.3s ease; }
                .form-input:focus { outline: none; border-color: var(--primary-color); }
            </style>
            <div class="modal">
                <div class="modal-content text-center space-y-4">
                    <h3>Set Pebbble Serial</h3>
                    <p>Scan a Pebbble or enter the serial number manually to finalize your playlist.</p>
                    <button id="modal-scan-serial-btn" class="btn btn-primary">Scan Pebbble (NFC)</button>
                    <div class="my-6 text-gray-400">-- OR --</div>
                    <input type="text" id="modal-manual-serial-input" placeholder="Enter Pebbble Serial Manually" class="form-input">
                    <button id="modal-manual-serial-btn" class="btn btn-secondary">Set Serial Manually</button>
                    <button id="modal-cancel-btn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        this.shadowRoot.querySelector('#modal-cancel-btn').addEventListener('click', () => {
            eventBus.publish('modal-close');
        });

        this.shadowRoot.querySelector('#modal-scan-serial-btn').addEventListener('click', () => {
            eventBus.publish('scan-serial-request');
        });

        this.shadowRoot.querySelector('#modal-manual-serial-btn').addEventListener('click', () => {
            const serial = this.shadowRoot.querySelector('#modal-manual-serial-input').value.trim();
            if (serial) {
                eventBus.publish('manual-serial-set', serial);
            } else {
                log('Please enter a valid serial number.', 'warning');
            }
        });
    }
}
customElements.define('serial-modal', SerialModal);
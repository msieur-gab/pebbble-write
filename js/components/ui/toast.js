// components/ui/toast.js

import { eventBus } from '../../services/eventBus.js';

class ToastComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
        this.toastQueue = [];
        this.isShowing = false;
        eventBus.subscribe('show-toast', this.handleShowToast.bind(this));
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    bottom: 2rem;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 50;
                    display: flex;
                    flex-direction: column-reverse; /* Show new toasts on top */
                    align-items: center;
                    pointer-events: none; /* Allows clicks to pass through empty space */
                }
                .toast {
                    background-color: var(--primary-color);
                    color: white;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                    opacity: 0;
                    transform: translateY(20px);
                    transition: all 0.4s ease-in-out;
                    margin-top: 0.5rem;
                    min-width: 250px;
                    text-align: center;
                    pointer-events: auto; /* Re-enable pointer events for the toast itself */
                }
                .toast.show {
                    opacity: 1;
                    transform: translateY(0);
                }
                .toast.success { background-color: var(--success-color); }
                .toast.error { background-color: var(--accent-color); }
                .toast.warning { background-color: var(--warning-color); }
            </style>
        `;
    }

    handleShowToast(data) {
        this.toastQueue.push(data);
        if (!this.isShowing) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.toastQueue.length === 0) {
            this.isShowing = false;
            return;
        }

        this.isShowing = true;
        const data = this.toastQueue.shift();
        const toast = document.createElement('div');
        toast.className = `toast show ${data.type}`;
        toast.textContent = data.message;
        
        this.shadowRoot.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => {
                toast.remove();
                this.processQueue();
            }, { once: true });
        }, 3000); // Toast disappears after 3 seconds
    }
}
customElements.define('toast-component', ToastComponent);
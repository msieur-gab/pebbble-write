// services/stateManager.js

import { eventBus } from './eventBus.js';

class StateManager {
    constructor() {
        this.state = {
            currentView: 'apiSetupForm' // Default starting view
        };
    }

    /**
     * Updates the application's current view state and publishes an event.
     * @param {string} newView - The new view name (e.g., 'playlistView', 'playlistCreationView').
     */
    setAppView(newView) {
        if (this.state.currentView !== newView) {
            this.state.currentView = newView;
            eventBus.publish('app-view-changed', this.state.currentView);
        }
    }

    getAppState() {
        return this.state;
    }
}

export const stateManager = new StateManager();
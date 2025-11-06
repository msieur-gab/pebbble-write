// services/arweaveStorageService.js
// Arweave storage service with support for testing (ArLocal, Irys devnet) and production
// Drop-in replacement for storageService.js - same interface, different backend

import { log } from '../utils/log.js';

/**
 * Storage modes:
 * - 'local': ArLocal (http://localhost:1984) - completely free, offline
 * - 'devnet': Irys devnet (https://devnet.irys.xyz) - free testnet with global access
 * - 'mainnet': Arweave mainnet (permanent storage, costs money)
 */

export class ArweaveStorageService {
    constructor(mode = 'local') {
        this.mode = mode;
        this.arweave = null;
        this.irys = null;

        // Gateway URLs for different modes
        this.gateways = {
            local: 'http://localhost:1984',
            devnet: 'https://gateway.irys.xyz',
            mainnet: 'https://arweave.net'
        };

        // Fallback gateways for production
        this.fallbackGateways = [
            'https://arweave.net',
            'https://arweave.dev',
            'https://g8way.io'
        ];
    }

    /**
     * Initialize the service based on mode
     * @param {Object} options - Configuration options
     * @param {string} options.privateKey - Wallet private key (for signing)
     * @param {string} options.mode - 'local', 'devnet', or 'mainnet'
     */
    async initialize(options = {}) {
        this.mode = options.mode || this.mode;

        log(`Initializing Arweave storage (mode: ${this.mode})`, 'info');

        if (this.mode === 'local') {
            await this.initializeArLocal();
        } else if (this.mode === 'devnet') {
            await this.initializeIrysDevnet(options.privateKey);
        } else if (this.mode === 'mainnet') {
            await this.initializeIrysMainnet(options.privateKey);
        }
    }

    /**
     * Initialize ArLocal (local testing)
     * No dependencies needed - uses native fetch
     */
    async initializeArLocal() {
        log('Using ArLocal at http://localhost:1984', 'info');

        // Test connection
        try {
            const response = await fetch('http://localhost:1984/info');
            if (!response.ok) {
                throw new Error('ArLocal not responding');
            }
            const info = await response.json();
            log(`ArLocal connected: height ${info.height}`, 'success');
        } catch (error) {
            log('⚠️ ArLocal not running! Start with: arlocal', 'error');
            throw new Error('ArLocal not available. Run "arlocal" in terminal.');
        }
    }

    /**
     * Initialize Irys devnet (free testing with global access)
     * Requires: npm install @irys/sdk
     */
    async initializeIrysDevnet(privateKey) {
        log('Connecting to Irys devnet...', 'info');

        // Note: In browser, you'd use WebIrys
        // For now, using fetch API directly (no SDK needed)
        this.irysUrl = 'https://devnet.irys.xyz';

        log('Irys devnet ready. Get free tokens at https://irys.xyz/faucet', 'success');
    }

    /**
     * Initialize Irys mainnet (production, costs money)
     */
    async initializeIrysMainnet(privateKey) {
        log('Connecting to Irys mainnet...', 'info');
        this.irysUrl = 'https://node2.irys.xyz';
        log('⚠️ Irys mainnet - uploads will cost real money!', 'warning');
    }

    /**
     * Upload message package to Arweave
     * Same interface as StorageService.uploadMessagePackage()
     *
     * @param {Object} messagePackage - The encrypted message package
     * @returns {string} Transaction ID (equivalent to IPFS hash)
     */
    async uploadMessagePackage(messagePackage) {
        log('Uploading encrypted package to Arweave...', 'info');

        const jsonString = JSON.stringify(messagePackage);
        const dataSize = new Blob([jsonString]).size;

        log(`Package size: ${(dataSize / 1024).toFixed(2)} KB`, 'info');

        if (this.mode === 'local') {
            return await this.uploadToArLocal(jsonString, messagePackage);
        } else if (this.mode === 'devnet' || this.mode === 'mainnet') {
            return await this.uploadToIrys(jsonString, messagePackage);
        }

        throw new Error(`Unknown mode: ${this.mode}`);
    }

    /**
     * Upload to ArLocal (local testing)
     */
    async uploadToArLocal(jsonString, messagePackage) {
        log('Uploading to ArLocal...', 'info');

        try {
            // Create transaction using ArLocal's simplified API
            const response = await fetch('http://localhost:1984/tx', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: btoa(jsonString),  // Base64 encode
                    tags: [
                        { name: 'Content-Type', value: 'application/json' },
                        { name: 'App-Name', value: 'Pebbble' },
                        { name: 'App-Version', value: 'v2.0-arweave-test' },
                        { name: 'Message-Id', value: messagePackage.messageId },
                        { name: 'Timestamp', value: messagePackage.timestamp.toString() },
                        { name: 'Encrypted', value: 'true' }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`ArLocal upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            const txId = result.id;

            log(`✅ Uploaded to ArLocal: ${txId}`, 'success');
            log(`   View at: http://localhost:1984/${txId}`, 'info');

            // Mine a block to confirm transaction (ArLocal specific)
            await fetch('http://localhost:1984/mine');

            return txId;

        } catch (error) {
            log(`❌ ArLocal upload failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Upload to Irys (devnet or mainnet)
     * Uses simple fetch - no SDK required
     */
    async uploadToIrys(jsonString, messagePackage) {
        const isDevnet = this.mode === 'devnet';
        log(`Uploading to Irys ${isDevnet ? 'devnet' : 'mainnet'}...`, 'info');

        try {
            // Convert string to bytes
            const dataBytes = new TextEncoder().encode(jsonString);

            // Create tags
            const tags = [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'App-Name', value: 'Pebbble' },
                { name: 'App-Version', value: 'v2.0' },
                { name: 'Message-Id', value: messagePackage.messageId },
                { name: 'Timestamp', value: messagePackage.timestamp.toString() },
                { name: 'Encrypted', value: 'true' }
            ];

            // For browser-based upload without SDK, we'll use the upload endpoint
            const formData = new FormData();
            formData.append('file', new Blob([dataBytes], { type: 'application/json' }));

            // Add tags as JSON string
            formData.append('tags', JSON.stringify(tags));

            const response = await fetch(`${this.irysUrl}/tx`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Irys upload failed: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            const txId = result.id;

            log(`✅ Uploaded to Irys: ${txId}`, 'success');
            log(`   View at: ${this.gateways[this.mode]}/${txId}`, 'info');

            if (!isDevnet) {
                log('⚠️ This upload costs real money!', 'warning');
            }

            return txId;

        } catch (error) {
            log(`❌ Irys upload failed: ${error.message}`, 'error');

            if (error.message.includes('insufficient funds')) {
                log('💰 Need to fund wallet. Visit: https://irys.xyz/faucet (devnet) or add real funds (mainnet)', 'warning');
            }

            throw error;
        }
    }

    /**
     * Download message package from Arweave
     * @param {string} txId - Transaction ID
     * @returns {Object} The message package
     */
    async getMessagePackage(txId) {
        log(`Fetching package from Arweave: ${txId}`, 'info');

        const gateway = this.gateways[this.mode];

        try {
            const response = await fetch(`${gateway}/${txId}`);

            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }

            const data = await response.json();
            log(`✅ Downloaded package: ${txId}`, 'success');

            return data;

        } catch (error) {
            // Try fallback gateways for mainnet
            if (this.mode === 'mainnet') {
                log('Trying fallback gateways...', 'warning');

                for (const fallback of this.fallbackGateways) {
                    try {
                        const response = await fetch(`${fallback}/${txId}`);
                        if (response.ok) {
                            const data = await response.json();
                            log(`✅ Downloaded via fallback: ${fallback}`, 'success');
                            return data;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            log(`❌ Download failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Check transaction status (mainly for mainnet)
     * @param {string} txId - Transaction ID
     * @returns {Object} Status info
     */
    async getTransactionStatus(txId) {
        if (this.mode === 'local') {
            // ArLocal transactions are instant
            return { confirmed: true, block_height: 1 };
        }

        try {
            const gateway = this.gateways[this.mode];
            const response = await fetch(`${gateway}/tx/${txId}/status`);

            if (!response.ok) {
                return { confirmed: false };
            }

            return await response.json();
        } catch (error) {
            log(`Status check failed: ${error.message}`, 'warning');
            return { confirmed: false };
        }
    }

    /**
     * Estimate upload cost (mainnet only)
     * @param {number} sizeInBytes - Data size
     * @returns {string} Estimated cost in USD
     */
    async estimateUploadCost(sizeInBytes) {
        if (this.mode !== 'mainnet') {
            return '0.00 (free testing)';
        }

        try {
            const response = await fetch(`${this.irysUrl}/price/bytes/${sizeInBytes}`);
            const priceInAtomic = await response.json();

            // Convert to USD (rough estimate, actual rate varies)
            const priceInUSD = (priceInAtomic / 1e18 * 2000).toFixed(4);

            return `$${priceInUSD}`;
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Generate gateway URL for a transaction
     * @param {string} txId - Transaction ID
     * @returns {string} Full URL to view/download
     */
    getGatewayUrl(txId) {
        return `${this.gateways[this.mode]}/${txId}`;
    }

    /**
     * Set mode dynamically (for testing different environments)
     * @param {string} mode - 'local', 'devnet', or 'mainnet'
     */
    setMode(mode) {
        if (!['local', 'devnet', 'mainnet'].includes(mode)) {
            throw new Error(`Invalid mode: ${mode}`);
        }

        this.mode = mode;
        log(`Switched to ${mode} mode`, 'info');
    }

    /**
     * Legacy compatibility: setCredentials (no-op for Arweave)
     * Included so this can be drop-in replacement for StorageService
     */
    setCredentials(apiKey, secret) {
        log('⚠️ Arweave does not use API credentials', 'warning');
        log('Use initialize() with privateKey instead', 'info');
    }
}

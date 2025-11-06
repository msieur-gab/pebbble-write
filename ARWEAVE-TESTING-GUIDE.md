# Arweave Testing Guide - Free Testing Methods

**Branch:** `claude/arweave-storage-testing`
**Date:** November 6, 2025
**Purpose:** Test Arweave storage without paying, keeping existing encryption

---

## Free Testing Options

### Option 1: Irys Devnet (Recommended for Initial Testing)

**Best for:** Testing upload/download flow without spending money

**Setup:**
```bash
# Install Irys SDK
npm install @irys/sdk

# Or use CDN in browser (no build step)
# <script type="module">
#   import Irys from 'https://unpkg.com/@irys/sdk'
# </script>
```

**Get Free Testnet Tokens:**
1. Create test Ethereum wallet: https://metamask.io
2. Get devnet tokens: https://irys.xyz/faucet
3. Paste wallet address, receive free tokens
4. Use wallet to upload to devnet

**Code Example:**
```javascript
import Irys from '@irys/sdk'

// Connect to devnet (FREE)
const irys = new Irys({
  url: 'https://devnet.irys.xyz',
  token: 'ethereum',
  key: privateKey  // Your test wallet private key
})

// Upload encrypted audio (FREE on devnet)
const receipt = await irys.upload(encryptedData, {
  tags: [
    { name: 'Content-Type', value: 'application/octet-stream' },
    { name: 'App-Name', value: 'Pebbble-Test' }
  ]
})

console.log(`TX ID: ${receipt.id}`)
console.log(`URL: https://gateway.irys.xyz/${receipt.id}`)

// Download (works exactly like mainnet)
const response = await fetch(`https://gateway.irys.xyz/${receipt.id}`)
const data = await response.arrayBuffer()
```

**Limitations:**
- ⚠️ Devnet data may be cleared periodically (not permanent like mainnet)
- ⚠️ Test tokens have no real value
- ✅ Perfect for development/testing

---

### Option 2: ArLocal (Local Simulator)

**Best for:** Offline development, CI/CD testing

**Setup:**
```bash
# Install globally
npm install -g arlocal

# Start local Arweave node
arlocal

# Output:
# arlocal started on port 1984
```

**Code Example:**
```javascript
import Arweave from 'arweave'

// Connect to local node
const arweave = Arweave.init({
  host: 'localhost',
  port: 1984,
  protocol: 'http'
})

// Create test wallet (instant, free)
const wallet = await arweave.wallets.generate()

// Mine block to fund wallet (local only)
await arweave.api.get('mine')

// Upload (instant on local)
const transaction = await arweave.createTransaction({
  data: encryptedData
}, wallet)

await arweave.transactions.sign(transaction, wallet)
await arweave.transactions.post(transaction)

console.log(`Local TX ID: ${transaction.id}`)

// Download from local node
const data = await arweave.transactions.getData(transaction.id, {
  decode: true
})
```

**Advantages:**
- ✅ Completely offline
- ✅ Instant confirmations
- ✅ No rate limits
- ✅ Free, unlimited storage

**Limitations:**
- ⚠️ Data only exists locally
- ⚠️ Not accessible from other devices
- ⚠️ Resets when you restart

---

### Option 3: Turbo Free Tier

**Best for:** Testing with real mainnet uploads (limited)

**Setup:**
```bash
npm install @ardrive/turbo-sdk
```

**Get Free Credits:**
1. Go to https://turbo.ardrive.io
2. Sign in with email
3. Get 100MB free credits per month
4. No credit card required

**Code Example:**
```javascript
import { TurboFactory } from '@ardrive/turbo-sdk'

const turbo = TurboFactory.authenticated({
  privateKey: yourPrivateKey,
  token: 'arweave'
})

// Check balance (free credits)
const balance = await turbo.getBalance()
console.log(`Credits: ${balance.winc}`)

// Upload (uses free credits first)
const result = await turbo.uploadFile({
  fileStreamFactory: () => encryptedDataStream,
  fileSizeFactory: () => encryptedData.length,
  signal: AbortSignal.timeout(10000)
})

console.log(`Mainnet TX ID: ${result.id}`)
console.log(`URL: https://arweave.net/${result.id}`)
```

**Advantages:**
- ✅ Real mainnet uploads
- ✅ Permanent storage (200+ years)
- ✅ 100MB free per month

**Limitations:**
- ⚠️ Limited to 100MB/month free
- ⚠️ After free tier, costs real money

---

## Testing Plan for Pebbble

### Phase 1: Local Testing (ArLocal)

**Goal:** Verify encryption works with Arweave without internet

```bash
# Terminal 1: Start ArLocal
arlocal

# Terminal 2: Run dev server
npm run dev  # or your dev command
```

**Test scenarios:**
1. Record audio → encrypt with NFC serial → upload to ArLocal
2. Generate NFC URL with TX ID
3. "Scan" NFC (simulate) → download from ArLocal → decrypt
4. Verify audio playback works

**Expected results:**
- ✅ Encryption/decryption works unchanged
- ✅ Upload returns TX ID
- ✅ Download retrieves correct data
- ✅ Audio plays correctly after decryption

---

### Phase 2: Devnet Testing (Irys)

**Goal:** Test with real internet gateway (still free)

**Steps:**
1. Get free devnet tokens from https://irys.xyz/faucet
2. Update config to use Irys devnet
3. Upload 5-10 test playlists
4. Test from different devices/browsers
5. Verify gateway access works globally

**Test scenarios:**
1. Upload from desktop → access from mobile
2. Upload large files (10-20MB)
3. Test concurrent uploads
4. Verify TX confirmation times
5. Test gateway failover

**Expected results:**
- ✅ Global access via URL
- ✅ Fast downloads (<2 seconds)
- ✅ Reliable across devices
- ✅ Encrypted data not readable without key

---

### Phase 3: Small Mainnet Test (Turbo Free Tier)

**Goal:** Validate real permanence before full migration

**Steps:**
1. Create 1-2 real playlists (< 50MB total)
2. Upload to Arweave mainnet (free credits)
3. Wait 24 hours
4. Verify still accessible
5. Test from multiple countries/networks

**Test scenarios:**
1. Create "time capsule" message for yourself
2. Upload to mainnet
3. Delete local copy
4. Wait 1 week
5. Retrieve and verify it still works

**Expected results:**
- ✅ Data survives 1+ week
- ✅ Accessible from anywhere
- ✅ No degradation in quality
- ✅ NFC URL still works

---

## Code Changes for Testing

### Minimal Changes Required

**Files to modify:**
1. Create `js/services/arweaveStorageService.js` (new file)
2. Add test mode flag in `config.js`
3. Create `arweave-test.html` (standalone test page)

**Files NOT modified:**
- ✅ `encryptionService.js` - UNCHANGED
- ✅ `playlistFinalizationService.js` - Keep existing logic
- ✅ Database schema - UNCHANGED
- ✅ NFC flow - UNCHANGED

**Only swap the storage layer:**

```javascript
// Before (IPFS)
const hash = await pinataService.upload(encrypted)

// After (Arweave)
const txId = await arweaveService.upload(encrypted)

// Everything else stays the same!
```

---

## Cost Comparison: Testing vs Production

### Testing Costs (FREE)

```
ArLocal: $0 (unlimited)
Irys Devnet: $0 (unlimited)
Turbo Free Tier: $0 (100MB/month)

Total testing cost: $0
```

### Production Costs (When Ready)

```
Small project (1GB total):
└─ $4 one-time → Forever

Medium project (100GB total):
└─ $400 one-time → Forever

Per playlist (50MB average):
└─ $0.20 one-time → Forever
```

---

## Migration Path

### Step 1: Test Locally (This Week)
- Use ArLocal
- Test encryption compatibility
- Verify download/decrypt flow

### Step 2: Test on Devnet (Next Week)
- Use Irys devnet
- Test with friends/family
- Collect feedback

### Step 3: Small Mainnet Pilot (Week 3)
- Use Turbo free credits
- 5-10 real users
- Monitor for issues

### Step 4: Full Migration (Week 4+)
- Set up Turbo/Irys production account
- Migrate existing playlists (optional)
- Update documentation
- Launch!

---

## Troubleshooting

### ArLocal won't start
```bash
# Check if port 1984 is in use
lsof -i :1984

# Kill existing process
kill -9 <PID>

# Start on different port
arlocal -p 1985
```

### Irys devnet wallet has no funds
```
Visit faucet: https://irys.xyz/faucet
Request tokens for your wallet address
Wait 1-2 minutes for confirmation
Check balance: irys.getLoadedBalance()
```

### Upload fails with "insufficient funds"
```javascript
// Check balance first
const balance = await irys.getLoadedBalance()
console.log(`Balance: ${balance}`)

// Fund wallet if needed (devnet: use faucet)
await irys.fund(irys.utils.toAtomic(0.1))
```

### Transaction not found after upload
```javascript
// Arweave takes 2-10 minutes to confirm
// Check status:
const status = await arweave.transactions.getStatus(txId)
console.log(status)

// If pending, wait and retry
if (status.confirmed === null) {
  console.log('Still pending, wait 2 minutes')
}
```

---

## Next Steps

1. **Start ArLocal** - Test locally first
2. **Create test page** - Simple upload/download demo
3. **Test encryption** - Verify your existing crypto works
4. **Measure performance** - Compare to Pinata
5. **Get feedback** - Share with beta users

---

## Resources

- **ArLocal GitHub:** https://github.com/textury/arlocal
- **Irys Docs:** https://docs.irys.xyz
- **Arweave Docs:** https://docs.arweave.org
- **Turbo Docs:** https://docs.ardrive.io/docs/turbo/

---

**Ready to test?** Start with ArLocal - it's the easiest!

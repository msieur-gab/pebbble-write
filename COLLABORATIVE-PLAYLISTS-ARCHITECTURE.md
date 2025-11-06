# Pebbble Collaborative Playlists - Architecture Analysis & Design

**Date:** November 6, 2025
**Status:** Design Phase - Architecture Discussion
**Purpose:** Document data flow analysis and design collaborative playlist feature with DID-based user management

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Co-Creation Feature Requirements](#co-creation-feature-requirements)
4. [Initial DID-Based Proposal](#initial-did-based-proposal)
5. [Refined Approach: Bucket/Folder Architecture](#refined-approach-bucketfolder-architecture)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Appendix: Technical Details](#appendix-technical-details)

---

## Executive Summary

### Current State

Pebbble is a **client-side-only encrypted audio playlist application** with:
- **No backend authentication** - Users identified only by Pinata API credentials
- **Single NFC tag encryption** - Each playlist encrypted with one NFC tag serial
- **IPFS storage via Pinata** - Encrypted audio blobs stored as immutable content
- **Local-first architecture** - IndexedDB for persistence before/after upload

### Design Goals

**Enable collaborative playlist creation** where:
1. Multiple users can contribute audio clips to shared playlists
2. Each user has their own NFC tag and identity (DID)
3. All users can encrypt/decrypt playlist content with owner's tag serial
4. Files remain encrypted on IPFS/cloud storage
5. Migration from Pinata to Filebase for better CDN coverage

### Key Architectural Decisions

**Identity:** Decentralized Identifiers (DIDs) with public/private key pairs
**User Discovery:** Public profiles pinned to IPFS, indexed in lightweight registry
**Key Distribution:** Tag serial encrypted with contributor's public key
**Storage:** Filebase buckets (or Pinata folders) with stable IDs instead of immutable CIDs
**Playlist Structure:** `playlist.json` files referencing contributors and audio files

---

## Current Architecture Analysis

### Project Structure

```
pebbble-write/
├── config.js                          # Pinata credentials, NFC URL config
├── main.js                            # App entry point
├── index.html                         # HTML shell
├── css/style.css                      # Responsive styles
└── js/
    ├── components/                    # Web Components (UI)
    │   ├── mainApp.js                 # Root component, navigation
    │   ├── apiSetupForm.js            # Pinata credential input
    │   ├── playlistCreator.js         # Playlist editor
    │   ├── playlistFinalization.js    # Encryption & upload workflow
    │   └── ...
    ├── services/                      # Business logic
    │   ├── appState.js                # State management
    │   ├── messageDb.js               # IndexedDB wrapper (Dexie.js)
    │   ├── storageService.js          # Pinata IPFS client
    │   ├── encryptionService.js       # AES-GCM encryption
    │   ├── playlistFinalizationService.js
    │   └── ...
    └── utils/                         # Utilities
```

### Current Data Flow

#### 1. Playlist Creation & Encryption

```
User Records Audio
    ↓
Store in IndexedDB (audioClips table)
    ↓
User Creates Playlist (references audioClipIds)
    ↓
User Scans NFC Tag → Get Serial "01:23:45:67"
    ↓
For Each Audio Clip:
    ├─ timestamp = Date.now()
    ├─ key = PBKDF2(timestamp, nfcSerial, iterations=100000)
    ├─ encrypted = AES-256-GCM(audioBuffer, key)
    ├─ package = { messageId, timestamp, encryptedAudio, metadata }
    └─ POST to Pinata → ipfsHash (e.g., QmABC123...)
    ↓
Create Playlist Manifest:
    {
      version: "playlist-v1",
      messages: [
        { messageId: "PBB-1-...", ipfsHash: "QmABC..." },
        { messageId: "PBB-2-...", ipfsHash: "QmDEF..." }
      ],
      metadata: { name, createdAt, totalClips }
    }
    ↓
Upload Manifest to Pinata → playlistHash (QmMANIFEST...)
    ↓
Save to IndexedDB (finalizedPlaylists table)
    ↓
Generate NFC URL: https://.../kid.html#playlistHash=QmMANIFEST...
```

#### 2. Encryption Details

**File:** `js/services/encryptionService.js`

```javascript
// Key Derivation
deriveEncryptionKey(serial, timestamp) {
  salt = hexToUint8Array(serial)  // e.g., "01:23:45:67" → bytes
  password = timestamp.toString()

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

// Encryption
encryptDataToBinary(data, key) {
  iv = crypto.getRandomValues(new Uint8Array(12))  // Random IV
  encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  )

  return concatenate(iv, encrypted)  // IV + ciphertext
}
```

#### 3. Storage Service (Pinata)

**File:** `js/services/storageService.js`

```javascript
uploadMessagePackage(messagePackage) {
  const formData = new FormData()
  formData.append('file', jsonBlob)
  formData.append('pinataMetadata', JSON.stringify({
    name: messagePackage.messageId
  }))

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'pinata_api_key': this.apiKey,
      'pinata_secret_api_key': this.secret
    },
    body: formData
  })

  const { IpfsHash } = await response.json()
  return IpfsHash  // e.g., "QmABC123..."
}
```

#### 4. Database Schema (IndexedDB)

```javascript
// messageDb.js - Dexie schema
db.version(4).stores({
  settings: 'key, value',                    // Pinata credentials
  audioClips: '++id, title, audioBlob, duration, timestamp',
  playlists: '++id, name, description, audioClipIds, timestamp',
  finalizedPlaylists: '++id, name, playlistHash, tagSerial, timestamp, audioClipIds'
})
```

### Critical Limitations for Co-Creation

1. **No User Identity System**
   - "Users" = Pinata API credentials in IndexedDB
   - No way to identify/distinguish collaborators

2. **Single NFC Tag Encryption**
   - Playlist encrypted with ONE tag serial
   - Other users can't decrypt without that specific tag

3. **Immutable IPFS Storage**
   - CIDs are content-addressed (hash of content)
   - Can't modify playlist manifest after upload
   - Contributors can't add their audio CIDs to existing manifest

4. **No Sharing Mechanism**
   - No way to invite collaborators
   - No way to share decryption keys
   - No access control lists

---

## Co-Creation Feature Requirements

### User Stories

**As a playlist owner, I want to:**
- Invite friends to contribute to my playlist
- Share my NFC tag serial securely with contributors
- See all contributions from collaborators
- Control who has access to the playlist

**As a contributor, I want to:**
- Receive invitations to collaborate
- Add my own audio clips to shared playlists
- Encrypt my audio with the owner's tag serial
- Have my contributions visible in the playlist

**As a reader (kid with NFC tag), I want to:**
- Scan the NFC tag once
- Hear all audio clips from all contributors
- Have seamless playback experience

### Technical Requirements

1. **User Management**
   - Decentralized identity (DIDs)
   - Public/private key pairs per user
   - User profile discovery

2. **Key Distribution**
   - Secure delivery of tag serial to contributors
   - Each contributor encrypts with SAME tag serial
   - Owner maintains control of master secret

3. **Collaborative Storage**
   - Multiple users upload to shared playlist
   - Track which user contributed which audio
   - Aggregate all contributions for playback

4. **Access Control**
   - Owner can add/remove collaborators
   - Contributors can only add, not delete
   - Audit trail of contributions

---

## Initial DID-Based Proposal

### Architecture Overview

**Decentralized Identity (DID):**
- Each user generates a DID (e.g., `did:key:z6MkhaX...`)
- DID derived from Ed25519 key pair
- Public key used for encrypting secrets
- Private key stored in IndexedDB (encrypted with user password)

**User Profiles on IPFS:**

```javascript
// Public Profile (IPFS, unencrypted, discoverable)
{
  version: "user-profile-v1",
  did: "did:key:z6MkhaXgBZDv...",
  publicKey: "-----BEGIN PUBLIC KEY-----...",
  profile: {
    displayName: "Alice",
    avatar: "QmAvatar...",
    bio: "Music enthusiast"
  },
  ipnsName: "/ipns/k51qzi5uqu5d..."  // For mutable data
}

// Private Profile (IPFS, encrypted with user's master key)
{
  version: "user-private-v1",
  did: "did:key:z6MkhaXgBZDv...",
  playlists: [
    {
      playlistId: "playlist-abc-123",
      name: "Meditation Series",
      role: "owner",
      tagSerial: "01:23:45:67",
      playlistManifestCID: "QmPlaylist...",
      collaborators: [
        {
          did: "did:key:z6Nk...",
          tagSerialEncrypted: "base64_encrypted_for_bob",
          addedAt: 1699123456000
        }
      ]
    }
  ],
  collaboratorOf: [...]
}
```

### Key Distribution Flow

```
1. Owner (Alice) creates playlist with NFC tag serial "01:23:45:67"
2. Alice wants to invite Bob
3. Alice looks up Bob's DID → fetches Bob's public profile from IPFS
4. Alice extracts Bob's public key
5. Alice encrypts tag serial:
   encryptedSerial = RSA_encrypt(bob_public_key, "01:23:45:67")
6. Alice creates invitation:
   {
     from: "did:key:alice",
     to: "did:key:bob",
     playlistId: "playlist-123",
     playlistManifestCID: "QmPlaylist...",
     tagSerialEncrypted: encryptedSerial,
     timestamp: ...
   }
7. Alice signs invitation with her private key
8. Alice pins invitation to IPFS
9. Bob receives notification (via backend or polling)
10. Bob fetches invitation, verifies signature
11. Bob decrypts tag serial with his private key:
    tagSerial = RSA_decrypt(bob_private_key, encryptedSerial)
    → "01:23:45:67"
12. Bob saves tag serial in his encrypted private profile
13. Bob can now encrypt audio with same tag serial
```

### Challenge: IPFS Immutability

**The Problem:**

```
Playlist Manifest at QmPlaylist123:
{
  messages: [
    { messageId: "PBB-1", ipfsHash: "QmAudio1" },  // Alice's audio
    { messageId: "PBB-2", ipfsHash: "QmAudio2" }   // Alice's audio
  ]
}

Bob uploads new audio → gets QmAudio3
❌ Can't modify QmPlaylist123 (it's immutable!)
❌ Can't add QmAudio3 to the manifest
```

**Proposed Solution: IPNS (Mutable Pointers)**

```
Playlist Manifest (immutable):
{
  playlistId: "playlist-123",
  collaborators: [
    {
      did: "did:key:alice",
      ipnsContributionFeed: "/ipns/k51..."  // Points to Alice's contributions
    },
    {
      did: "did:key:bob",
      ipnsContributionFeed: "/ipns/k52..."  // Points to Bob's contributions
    }
  ]
}

Alice's Contribution Feed (mutable via IPNS):
IPNS: /ipns/k51... → QmAliceContribs_v3
{
  playlistId: "playlist-123",
  contributions: [
    { audioCID: "QmAudio1", timestamp: ... },
    { audioCID: "QmAudio2", timestamp: ... }
  ]
}

Bob's Contribution Feed (mutable via IPNS):
IPNS: /ipns/k52... → QmBobContribs_v1
{
  playlistId: "playlist-123",
  contributions: [
    { audioCID: "QmAudio3", timestamp: ... }
  ]
}

Reader App:
1. Fetch playlist manifest (QmPlaylist123)
2. For each collaborator:
   - Resolve IPNS name (10-30 second delay ⚠️)
   - Fetch contribution feed
3. Aggregate all audio CIDs
4. Fetch and decrypt each audio
```

**Drawbacks:**
- ⚠️ IPNS resolution is SLOW (10-30 seconds per collaborator)
- ⚠️ Requires IPNS pinning (additional cost)
- ⚠️ Complex client logic

---

## Refined Approach: Bucket/Folder Architecture

### Key Insight from User

**Filebase Buckets & Pinata Folders:**
- Both services support **stable IDs** instead of content-addressed CIDs
- Files can be **updated in place** using the same ID
- Enables **mutable storage** while maintaining IPFS benefits
- Each playlist can have its own bucket/folder
- `playlist.json` file tracks contributors and audio files

### Revised Architecture

#### Storage Structure

```
Filebase Bucket: "playlist-abc-123"
├── playlist.json              # Master playlist manifest (mutable!)
├── alice/
│   ├── audio-1.json          # Alice's first audio
│   ├── audio-2.json          # Alice's second audio
│   └── contributions.json    # Alice's contribution index
└── bob/
    ├── audio-1.json          # Bob's audio
    └── contributions.json    # Bob's contribution index
```

**OR** (Pinata Folders):

```
Pinata Folder: "playlist-abc-123"
├── playlist.json
├── alice_audio_1.json
├── alice_audio_2.json
├── bob_audio_1.json
└── contributors.json
```

#### Playlist JSON Schema

```javascript
// playlist.json (stored in bucket/folder, updatable!)
{
  version: "playlist-v2-collaborative",
  playlistId: "playlist-abc-123",
  bucketId: "bucket_xyz789",  // Filebase bucket ID or Pinata folder ID
  metadata: {
    name: "Meditation Series",
    description: "Calming audio guides",
    createdAt: 1699123456000,
    createdBy: "did:key:z6MkhaX..."  // Owner's DID
  },
  encryption: {
    tagSerial: null,  // NOT stored here (in encrypted user profiles)
    algorithm: "AES-256-GCM",
    keyDerivation: "PBKDF2-SHA256",
    iterations: 100000
  },
  collaborators: [
    {
      did: "did:key:z6MkhaX...",
      displayName: "Alice",
      role: "owner",
      publicKeyUrl: "https://gateway.pinata.cloud/ipfs/QmAliceProfile",
      joinedAt: 1699123456000,
      contributionCount: 2
    },
    {
      did: "did:key:z6Nk...",
      displayName: "Bob",
      role: "contributor",
      publicKeyUrl: "https://gateway.pinata.cloud/ipfs/QmBobProfile",
      joinedAt: 1699125000000,
      contributionCount: 1
    }
  ],
  audioFiles: [
    {
      fileId: "file_abc123",           // Filebase/Pinata stable ID
      messageId: "PBB-1-1699123456000",
      contributor: "did:key:z6MkhaX...",
      timestamp: 1699123456000,
      metadata: {
        title: "Intro - Breathing",
        duration: 180,
        encryptedSize: 245678
      },
      signature: "..."  // Signed by contributor
    },
    {
      fileId: "file_def456",
      messageId: "PBB-2-1699124000000",
      contributor: "did:key:z6MkhaX...",
      timestamp: 1699124000000,
      metadata: {
        title: "Body Scan",
        duration: 300,
        encryptedSize: 412345
      },
      signature: "..."
    },
    {
      fileId: "file_ghi789",
      messageId: "PBB-3-1699125100000",
      contributor: "did:key:z6Nk...",  // Bob's contribution
      timestamp: 1699125100000,
      metadata: {
        title: "Closing Meditation",
        duration: 240,
        encryptedSize: 328901
      },
      signature: "..."
    }
  ],
  lastUpdated: 1699125100000
}
```

### Complete Workflow

#### Phase 1: User Registration

```
1. User opens app
2. Choose "Create Account" or "Sign In"
3. Generate DID (did:key method)
   - Generate Ed25519 key pair
   - Derive DID from public key
4. User enters display name, password
5. Encrypt private key with password → store in IndexedDB
6. Create public profile:
   {
     did: "did:key:...",
     publicKey: "...",
     displayName: "Alice",
     createdAt: ...
   }
7. Pin public profile to IPFS → get profileCID
8. Register with backend:
   POST /api/users/register
   {
     did: "did:key:...",
     publicProfileCID: "QmAlice..."
   }
9. Backend stores: DID → profileCID mapping
```

#### Phase 2: Create Playlist & Invite Collaborators

```
OWNER (Alice):

1. Create Filebase bucket OR Pinata folder:
   POST /api/storage/create-playlist-bucket
   {
     playlistName: "meditation-series",
     ownerDID: "did:key:alice"
   }
   → Returns: { bucketId: "bucket_xyz789" }

2. Record/upload audio clips locally (existing flow)

3. Scan NFC tag → get serial "01:23:45:67"

4. Encrypt audio clips with tag serial (existing encryptionService)

5. Upload encrypted audio to bucket:
   PUT /bucket/playlist-abc-123/alice/audio-1.json
   → Returns: { fileId: "file_abc123" }

6. Create initial playlist.json:
   {
     playlistId: "playlist-abc-123",
     bucketId: "bucket_xyz789",
     collaborators: [{ did: "did:key:alice", role: "owner" }],
     audioFiles: [{ fileId: "file_abc123", ... }]
   }

7. Upload playlist.json to bucket:
   PUT /bucket/playlist-abc-123/playlist.json

8. Save to own encrypted private profile:
   {
     playlists: [{
       playlistId: "playlist-abc-123",
       bucketId: "bucket_xyz789",
       tagSerial: "01:23:45:67",  // Stored encrypted locally
       role: "owner"
     }]
   }

9. Update private profile → pin to IPFS

INVITE BOB:

10. Alice searches for Bob by DID:
    GET /api/users/search?did=did:key:bob
    → Returns: { publicProfileCID: "QmBob..." }

11. Fetch Bob's public profile from IPFS:
    GET https://gateway.pinata.cloud/ipfs/QmBob...
    → Extract Bob's public key

12. Encrypt tag serial for Bob:
    encryptedSerial = RSA_encrypt(bob_public_key, "01:23:45:67")

13. Create invitation:
    {
      type: "playlist-invitation",
      from: "did:key:alice",
      to: "did:key:bob",
      playlistId: "playlist-abc-123",
      bucketId: "bucket_xyz789",
      playlistJsonUrl: "https://.../playlist.json",
      tagSerialEncrypted: encryptedSerial,
      timestamp: ...,
      signature: "..."  // Signed by Alice
    }

14. Send invitation:
    POST /api/invitations/send
    Body: invitation object
    → Backend stores invitation for Bob

15. Bob receives notification (push or polling)
```

#### Phase 3: Contributor Adds Audio

```
CONTRIBUTOR (Bob):

1. Fetch pending invitations:
   GET /api/invitations/pending?did=did:key:bob
   → Returns: [invitation]

2. Decrypt invitation (verify Alice's signature)

3. Decrypt tag serial:
   tagSerial = RSA_decrypt(bob_private_key, encryptedSerial)
   → "01:23:45:67"

4. Save to own encrypted private profile:
   {
     collaboratorOf: [{
       playlistId: "playlist-abc-123",
       bucketId: "bucket_xyz789",
       owner: "did:key:alice",
       tagSerial: "01:23:45:67",  // Encrypted locally
       role: "contributor"
     }]
   }

5. Record new audio

6. Encrypt with SAME tag serial + timestamp (existing flow):
   key = PBKDF2(timestamp, "01:23:45:67")
   encrypted = AES-GCM(audioBuffer, key)

7. Upload to bucket:
   PUT /bucket/playlist-abc-123/bob/audio-1.json
   Body: encrypted audio package
   → Returns: { fileId: "file_ghi789" }

8. Update playlist.json (atomic update):
   a. Fetch current playlist.json
   b. Add new entry to audioFiles array:
      {
        fileId: "file_ghi789",
        messageId: "PBB-3-...",
        contributor: "did:key:bob",
        timestamp: ...,
        metadata: { title: "Closing", duration: 240 },
        signature: sign(bob_private_key, fileId + timestamp)
      }
   c. Increment contributionCount for Bob
   d. Update lastUpdated
   e. PUT /bucket/playlist-abc-123/playlist.json
      (With optimistic locking or conflict resolution)

9. Optionally notify owner:
   POST /api/notifications/send
   {
     to: "did:key:alice",
     type: "new-contribution",
     playlistId: "playlist-abc-123"
   }
```

#### Phase 4: Playback

```
READER (Kid with NFC tag):

1. Scan NFC tag → get URL:
   https://.../kid.html#playlistId=playlist-abc-123&bucketId=bucket_xyz789

2. Scan tag again → get serial "01:23:45:67"

3. Fetch playlist.json:
   GET /bucket/bucket_xyz789/playlist.json
   → Returns: { audioFiles: [...], collaborators: [...] }

4. For each audio file:
   a. Fetch encrypted audio:
      GET /bucket/bucket_xyz789/{fileId}
      → Returns: encrypted audio package

   b. Extract timestamp from package

   c. Derive decryption key:
      key = PBKDF2(timestamp, "01:23:45:67")

   d. Decrypt:
      audioBuffer = AES-GCM-decrypt(encryptedAudio, key)

   e. Verify contributor signature (optional, for integrity)

   f. Play audio via Web Audio API

5. All audio clips play seamlessly (regardless of contributor)
```

### Advantages of Bucket/Folder Approach

| Feature | IPNS Approach | Bucket/Folder Approach |
|---------|---------------|------------------------|
| **Mutability** | Yes (via IPNS) | Yes (native file updates) |
| **Speed** | Slow (10-30s resolution) | Fast (instant) |
| **Complexity** | High (IPNS pinning, resolution) | Low (standard API) |
| **Cost** | Higher (IPNS pinning fees) | Lower (standard storage) |
| **Atomicity** | Eventual consistency | Atomic updates (with locking) |
| **CDN** | Limited | Excellent (Filebase CDN) |
| **Discoverability** | Hard (need IPNS names) | Easy (stable bucket/folder IDs) |

### Technical Implementation Details

#### Filebase Bucket Operations

```javascript
// storageService.js - Filebase version

class FilebaseStorageService {
  constructor(accessKey, secretKey) {
    this.s3Client = new S3Client({
      endpoint: 'https://s3.filebase.com',
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey }
    })
  }

  // Create playlist bucket
  async createPlaylistBucket(playlistId) {
    await this.s3Client.send(new CreateBucketCommand({
      Bucket: playlistId  // e.g., "playlist-abc-123"
    }))
    return playlistId
  }

  // Upload audio file
  async uploadAudioFile(bucketId, contributor, audioPackage) {
    const key = `${contributor}/audio-${Date.now()}.json`

    const result = await this.s3Client.send(new PutObjectCommand({
      Bucket: bucketId,
      Key: key,
      Body: JSON.stringify(audioPackage),
      Metadata: {
        'contributor': contributor,
        'message-id': audioPackage.messageId
      }
    }))

    return {
      fileId: key,  // S3 key serves as stable ID
      versionId: result.VersionId
    }
  }

  // Update playlist.json (with optimistic locking)
  async updatePlaylistManifest(bucketId, updateFn) {
    // 1. Fetch current version
    const current = await this.getPlaylistManifest(bucketId)

    // 2. Apply update
    const updated = updateFn(current)

    // 3. Write back (S3 versioning handles conflicts)
    await this.s3Client.send(new PutObjectCommand({
      Bucket: bucketId,
      Key: 'playlist.json',
      Body: JSON.stringify(updated),
      Metadata: {
        'version': updated.lastUpdated.toString()
      }
    }))

    return updated
  }

  // Fetch playlist.json
  async getPlaylistManifest(bucketId) {
    const result = await this.s3Client.send(new GetObjectCommand({
      Bucket: bucketId,
      Key: 'playlist.json'
    }))

    const body = await streamToString(result.Body)
    return JSON.parse(body)
  }

  // Fetch encrypted audio
  async getAudioFile(bucketId, fileId) {
    const result = await this.s3Client.send(new GetObjectCommand({
      Bucket: bucketId,
      Key: fileId
    }))

    const body = await streamToString(result.Body)
    return JSON.parse(body)
  }
}
```

#### Pinata Folder Operations (Alternative)

```javascript
// storageService.js - Pinata folders version

class PinataFolderStorageService {
  constructor(apiKey, secret) {
    this.apiKey = apiKey
    this.secret = secret
    this.baseUrl = 'https://api.pinata.cloud'
  }

  // Create playlist folder
  async createPlaylistFolder(playlistId) {
    // Pinata doesn't have explicit folder creation
    // Folders are implicit via file paths
    return playlistId
  }

  // Upload audio file to folder
  async uploadAudioFile(playlistId, contributor, audioPackage) {
    const fileName = `${playlistId}/${contributor}/audio-${Date.now()}.json`

    const formData = new FormData()
    formData.append('file', new Blob([JSON.stringify(audioPackage)]))
    formData.append('pinataMetadata', JSON.stringify({
      name: fileName,
      keyvalues: {
        playlistId: playlistId,
        contributor: contributor,
        messageId: audioPackage.messageId
      }
    }))
    formData.append('pinataOptions', JSON.stringify({
      cidVersion: 1
    }))

    const response = await fetch(`${this.baseUrl}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        'pinata_api_key': this.apiKey,
        'pinata_secret_api_key': this.secret
      },
      body: formData
    })

    const { IpfsHash } = await response.json()
    return {
      fileId: IpfsHash,  // CID serves as ID (still immutable per file)
      fileName: fileName
    }
  }

  // Update playlist.json
  // NOTE: With Pinata, each update creates a NEW CID
  // Need to track latest CID externally (in database or IPNS)
  async updatePlaylistManifest(playlistId, manifestData) {
    const fileName = `${playlistId}/playlist.json`

    const formData = new FormData()
    formData.append('file', new Blob([JSON.stringify(manifestData)]))
    formData.append('pinataMetadata', JSON.stringify({
      name: fileName
    }))

    const response = await fetch(`${this.baseUrl}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        'pinata_api_key': this.apiKey,
        'pinata_secret_api_key': this.secret
      },
      body: formData
    })

    const { IpfsHash } = await response.json()

    // Important: Store this new CID as the "current" playlist manifest
    // Could use IPNS to point to latest CID
    // OR store in backend database: playlistId → latestManifestCID

    return {
      manifestCID: IpfsHash,
      manifestData: manifestData
    }
  }

  // Fetch playlist.json
  async getPlaylistManifest(manifestCID) {
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${manifestCID}`)
    return await response.json()
  }

  // Fetch audio file
  async getAudioFile(audioCID) {
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${audioCID}`)
    return await response.json()
  }
}
```

#### Key Differences: Filebase vs Pinata

| Aspect | Filebase (S3) | Pinata (IPFS) |
|--------|---------------|---------------|
| **Mutability** | ✅ True mutable storage | ⚠️ Each update = new CID |
| **Stable IDs** | ✅ S3 keys are stable | ⚠️ CIDs change on update |
| **Folders** | ✅ Native folder support | ⚠️ Folders are path prefixes |
| **Playlist Updates** | ✅ Update in place | ⚠️ Need IPNS or DB to track latest CID |
| **API** | S3-compatible | Custom REST API |
| **CDN** | Excellent global CDN | Good IPFS gateways |
| **Cost** | Storage + bandwidth | Pinning + bandwidth |
| **IPFS Native** | ⚠️ Abstracted | ✅ True IPFS |

**Recommendation:** **Filebase for collaborative playlists** due to true mutability and simpler update logic.

**Pinata Alternative:** If staying with Pinata, use IPNS or backend database to track latest `playlist.json` CID.

---

## Implementation Roadmap

### Phase 1: DID & User Management (3-4 weeks)

**Goal:** Replace API credentials with user accounts

**Tasks:**
1. Implement DID generation (`did:key` method)
   - `js/services/didService.js`
   - Generate Ed25519 key pairs
   - Derive DIDs from public keys

2. Create user profile schemas
   - Public profile (IPFS, unencrypted)
   - Private profile (IPFS, encrypted)

3. Build authentication UI
   - Replace `apiSetupForm.js` with `userAuthForm.js`
   - Sign up / sign in flows
   - Password-based private key encryption

4. Implement backend registry API
   - `POST /api/users/register` - Register DID → profileCID
   - `GET /api/users/search?did=...` - Look up users
   - `GET /api/users/profile/:did` - Get profile CID

5. Update `messageDb.js`
   - Add `user` table: `did, privateKey (encrypted), publicProfileCID`
   - Migrate from `settings` (credentials) to `user` (DID)

6. Update `appState.js`
   - Replace `apiCredentials` with `currentUser: { did, displayName }`

**Files to Create:**
- `js/services/didService.js`
- `js/services/userProfileService.js`
- `js/components/userAuthForm.js`

**Files to Modify:**
- `js/services/messageDb.js`
- `js/services/appState.js`
- `js/components/mainApp.js`
- `config.js` (add backend API URL)

---

### Phase 2: Filebase Migration (2-3 weeks)

**Goal:** Replace Pinata with Filebase for mutable storage

**Tasks:**
1. Set up Filebase account & credentials

2. Install AWS SDK for S3
   ```bash
   npm install @aws-sdk/client-s3
   ```

3. Refactor `storageService.js`
   - Implement `FilebaseStorageService` class
   - Replace Pinata REST calls with S3 API
   - Add bucket management methods:
     - `createPlaylistBucket(playlistId)`
     - `uploadAudioFile(bucketId, contributor, package)`
     - `updatePlaylistManifest(bucketId, updateFn)`
     - `getPlaylistManifest(bucketId)`
     - `getAudioFile(bucketId, fileId)`

4. Update configuration
   - Replace `PINATA_API_KEY`/`PINATA_SECRET` with:
     - `FILEBASE_ACCESS_KEY`
     - `FILEBASE_SECRET_KEY`

5. Update `playlistFinalizationService.js`
   - Create bucket on finalization
   - Upload playlist.json to bucket
   - Store `bucketId` instead of `playlistHash`

6. Update `messageDb.js` schema
   - `finalizedPlaylists`: Change `playlistHash` → `bucketId`

7. Update `urlParser.js`
   - Generate NFC URLs with `bucketId` parameter
   - Update gateway URLs for Filebase

8. Update reader app
   - Fetch from Filebase S3 endpoints
   - Parse new URL format

9. Build tool setup (for AWS SDK)
   - Add bundler (Rollup/Webpack/Vite)
   - Bundle AWS SDK for browser

**Files to Create:**
- `package.json` (if not exists)
- `rollup.config.js` or equivalent

**Files to Modify:**
- `js/services/storageService.js`
- `js/services/playlistFinalizationService.js`
- `js/services/messageDb.js`
- `js/utils/urlParser.js`
- `config.js`

---

### Phase 3: Key Distribution & Invitations (2-3 weeks)

**Goal:** Enable secure sharing of tag serial with collaborators

**Tasks:**
1. Implement RSA encryption utilities
   - `js/services/cryptoService.js`
   - `encryptWithPublicKey(publicKey, data)`
   - `decryptWithPrivateKey(privateKey, encryptedData)`
   - `signData(privateKey, data)`
   - `verifySignature(publicKey, data, signature)`

2. Build invitation system
   - `js/services/invitationService.js`
   - Create invitation schema
   - Encrypt tag serial with recipient's public key
   - Sign invitation with sender's private key

3. Backend invitation API
   - `POST /api/invitations/send` - Send invitation
   - `GET /api/invitations/pending?did=...` - Get pending invitations
   - `POST /api/invitations/accept` - Accept invitation
   - `POST /api/invitations/decline` - Decline invitation

4. Build invitation UI
   - `js/components/inviteCollaboratorModal.js`
   - Search users by DID
   - Send invitation
   - Show pending invitations
   - Accept/decline flow

5. Update `playlistCreator.js`
   - Add "Invite Collaborator" button
   - Show list of current collaborators

6. Update private profile encryption
   - Store tag serial encrypted in private profile
   - Store invitation metadata

**Files to Create:**
- `js/services/cryptoService.js`
- `js/services/invitationService.js`
- `js/components/inviteCollaboratorModal.js`

**Files to Modify:**
- `js/components/playlistCreator.js`
- `js/services/userProfileService.js`

---

### Phase 4: Collaborative Playlist Updates (2-3 weeks)

**Goal:** Allow contributors to add audio to shared playlists

**Tasks:**
1. Update `playlist.json` schema
   - Add `collaborators` array
   - Add `audioFiles` array with contributor metadata
   - Add `bucketId` field

2. Implement atomic playlist updates
   - Optimistic locking in `storageService.js`
   - Conflict resolution strategy
   - Retry logic

3. Build contribution flow
   - `js/services/contributionService.js`
   - `contributeToPlaylist(playlistId, audioPackage)`
   - Fetch current playlist.json
   - Add audio entry
   - Update collaborator stats
   - Sign contribution

4. Update `playlistFinalization.js`
   - Check if user is owner or contributor
   - If contributor: load tag serial from private profile
   - If owner: use tag from NFC scan

5. Add "My Playlists" vs "Shared with Me" views
   - `js/components/myPlaylistsView.js`
   - `js/components/sharedPlaylistsView.js`
   - Filter by role (owner/contributor)

6. Signature verification
   - Verify contributor signatures on playback
   - Detect tampering

**Files to Create:**
- `js/services/contributionService.js`
- `js/components/myPlaylistsView.js`
- `js/components/sharedPlaylistsView.js`

**Files to Modify:**
- `js/services/storageService.js`
- `js/components/playlistFinalization.js`
- `js/components/playlistsView.js`

---

### Phase 5: Reader App Updates (1 week)

**Goal:** Enable seamless playback of collaborative playlists

**Tasks:**
1. Update reader app URL parsing
   - Parse `bucketId` parameter
   - Fetch playlist.json from Filebase

2. Aggregate audio from all contributors
   - Fetch all audio files listed in playlist.json
   - Sort by timestamp
   - Decrypt each with tag serial

3. Show contributor info
   - Display contributor name per clip
   - Show avatar/profile (optional)

4. Error handling
   - Handle missing files
   - Handle decryption failures
   - Show friendly error messages

**Files to Modify:**
- Reader app HTML/JS (separate repo?)

---

### Phase 6: Testing & Polish (2 weeks)

**Goal:** Ensure reliability and user experience

**Tasks:**
1. Unit tests
   - DID generation
   - Encryption/decryption
   - Signature verification

2. Integration tests
   - Full invitation flow
   - Contribution flow
   - Playback flow

3. Concurrent update testing
   - Multiple contributors adding simultaneously
   - Conflict resolution

4. Performance optimization
   - Parallel audio fetch
   - Caching strategy
   - Lazy loading

5. Security audit
   - Key storage security
   - Signature verification
   - Prevent unauthorized contributions

6. UX improvements
   - Loading states
   - Error messages
   - Onboarding flow

---

## Next Steps

### Immediate Actions

1. **Decision: Filebase vs Pinata**
   - If true mutability needed → **Filebase**
   - If IPFS-native preferred → **Pinata + backend DB for latest CIDs**

2. **Prototype DID System**
   - Implement `didService.js`
   - Test key generation and DID derivation
   - Validate DID format

3. **Design Backend API Contracts**
   - User registry endpoints
   - Invitation endpoints
   - Notification system

4. **Create Test Scenarios**
   - Owner creates playlist
   - Owner invites contributor
   - Contributor adds audio
   - Reader plays playlist

### Questions to Answer

1. **Backend Hosting:** Where will registry/invitation APIs be hosted?
   - Vercel/Netlify functions?
   - Dedicated server?
   - Decentralized (libp2p, IPFS pubsub)?

2. **Notification Mechanism:** How to notify users of invitations?
   - Push notifications (requires service worker)?
   - Polling (simpler, higher latency)?
   - Websockets (real-time, requires persistent connection)?

3. **IPNS vs Backend DB:** For tracking latest playlist.json CID (if using Pinata):
   - IPNS (decentralized, slow)?
   - Backend DB (centralized, fast)?

4. **Access Control:** How to prevent unauthorized bucket writes?
   - Filebase bucket policies?
   - Backend proxy for all uploads?
   - Signed upload URLs?

5. **Migration Strategy:** How to handle existing playlists?
   - Leave on Pinata (read-only)?
   - Migrate to Filebase (bulk operation)?
   - Support both systems?

---

## Appendix: Technical Details

### A. DID Generation (did:key method)

```javascript
// js/services/didService.js

import { base58btc } from 'multiformats/bases/base58'
import * as ed25519 from '@noble/ed25519'

class DIDService {
  async generateDID() {
    // 1. Generate Ed25519 key pair
    const privateKey = ed25519.utils.randomPrivateKey()
    const publicKey = await ed25519.getPublicKey(privateKey)

    // 2. Encode public key with multicodec prefix
    // 0xed01 = Ed25519 public key
    const multicodecPubKey = new Uint8Array([0xed, 0x01, ...publicKey])

    // 3. Encode with base58btc
    const encoded = base58btc.encode(multicodecPubKey)

    // 4. Create DID
    const did = `did:key:${encoded}`
    // Example: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"

    return {
      did,
      publicKey: this.bytesToBase64(publicKey),
      privateKey: this.bytesToBase64(privateKey)
    }
  }

  async exportPublicKey(publicKeyBytes) {
    // Convert to PEM format for RSA encryption
    return await crypto.subtle.exportKey(
      'spki',
      await crypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'Ed25519' },
        true,
        ['verify']
      )
    )
  }

  bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...bytes))
  }

  base64ToBytes(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  }
}
```

### B. RSA Key Wrapping for Tag Serial

```javascript
// js/services/cryptoService.js

class CryptoService {
  // Encrypt tag serial with recipient's public key
  async encryptWithPublicKey(publicKeyPem, data) {
    // Import public key
    const publicKey = await crypto.subtle.importKey(
      'spki',
      this.pemToArrayBuffer(publicKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    )

    // Encrypt data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      new TextEncoder().encode(data)
    )

    return this.arrayBufferToBase64(encrypted)
  }

  // Decrypt tag serial with own private key
  async decryptWithPrivateKey(privateKeyPem, encryptedData) {
    // Import private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      this.pemToArrayBuffer(privateKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    )

    // Decrypt data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      this.base64ToArrayBuffer(encryptedData)
    )

    return new TextDecoder().decode(decrypted)
  }

  // Sign data with private key
  async signData(privateKeyPem, data) {
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      this.pemToArrayBuffer(privateKeyPem),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(data)
    )

    return this.arrayBufferToBase64(signature)
  }

  // Verify signature with public key
  async verifySignature(publicKeyPem, data, signature) {
    const publicKey = await crypto.subtle.importKey(
      'spki',
      this.pemToArrayBuffer(publicKeyPem),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    )

    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      this.base64ToArrayBuffer(signature),
      new TextEncoder().encode(data)
    )
  }

  // Utility functions
  pemToArrayBuffer(pem) {
    const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
    return this.base64ToArrayBuffer(b64)
  }

  arrayBufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
  }

  base64ToArrayBuffer(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer
  }
}
```

### C. Playlist Manifest Update with Optimistic Locking

```javascript
// js/services/storageService.js

async addContributionToPlaylist(bucketId, audioFileEntry) {
  const maxRetries = 3
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      // 1. Fetch current manifest
      const manifest = await this.getPlaylistManifest(bucketId)
      const currentVersion = manifest.lastUpdated

      // 2. Add new audio file
      manifest.audioFiles.push(audioFileEntry)

      // 3. Update contributor stats
      const contributor = manifest.collaborators.find(
        c => c.did === audioFileEntry.contributor
      )
      if (contributor) {
        contributor.contributionCount++
      }

      // 4. Update timestamp
      manifest.lastUpdated = Date.now()

      // 5. Write back with version check
      await this.s3Client.send(new PutObjectCommand({
        Bucket: bucketId,
        Key: 'playlist.json',
        Body: JSON.stringify(manifest),
        Metadata: {
          'expected-version': currentVersion.toString()
        }
      }))

      return manifest

    } catch (error) {
      if (error.name === 'PreconditionFailed') {
        // Another contributor updated simultaneously, retry
        retryCount++
        await this.sleep(100 * retryCount)  // Exponential backoff
      } else {
        throw error
      }
    }
  }

  throw new Error('Failed to update playlist after max retries')
}

sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### D. Backend API Contracts

#### User Registry

```http
POST /api/users/register
Content-Type: application/json

{
  "did": "did:key:z6MkhaXgBZDv...",
  "publicProfileCID": "QmABC123...",
  "signature": "..."  // Signed by private key to prove ownership
}

Response 200 OK:
{
  "success": true,
  "did": "did:key:z6MkhaXgBZDv..."
}
```

```http
GET /api/users/search?did=did:key:z6MkhaXgBZDv...

Response 200 OK:
{
  "did": "did:key:z6MkhaXgBZDv...",
  "publicProfileCID": "QmABC123...",
  "registeredAt": 1699123456000
}
```

#### Invitations

```http
POST /api/invitations/send
Content-Type: application/json

{
  "from": "did:key:alice",
  "to": "did:key:bob",
  "invitation": {
    "type": "playlist-invitation",
    "playlistId": "playlist-abc-123",
    "bucketId": "bucket_xyz789",
    "tagSerialEncrypted": "base64...",
    "timestamp": 1699123456000,
    "signature": "..."
  }
}

Response 200 OK:
{
  "success": true,
  "invitationId": "inv_123"
}
```

```http
GET /api/invitations/pending?did=did:key:bob

Response 200 OK:
{
  "invitations": [
    {
      "invitationId": "inv_123",
      "from": "did:key:alice",
      "invitation": { ... },
      "receivedAt": 1699123456000
    }
  ]
}
```

---

## Summary

This document outlines a comprehensive architecture for adding collaborative playlist features to Pebbble:

**Key Innovations:**
1. **DID-based user identity** - Decentralized, self-sovereign
2. **Public/private key infrastructure** - Secure key distribution
3. **Bucket/folder storage** - Mutable playlists via Filebase (or Pinata + DB)
4. **Encrypted tag serial sharing** - Owner controls master secret
5. **Collaborative manifest updates** - Multiple contributors to one playlist

**Benefits:**
- Maintains encryption-first security model
- Enables true multi-user collaboration
- Preserves decentralization goals (with minimal backend)
- Scales to many contributors per playlist
- Better CDN coverage with Filebase

**Next Steps:**
1. Finalize storage provider choice (Filebase recommended)
2. Prototype DID system
3. Design backend API contracts
4. Begin Phase 1 implementation (user management)

---

**Document Version:** 1.0
**Last Updated:** November 6, 2025
**Contributors:** Claude (AI Assistant), User (Project Owner)

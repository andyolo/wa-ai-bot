[![Logo](https://files.catbox.moe/c5s9g0.jpg)](https://www.npmjs.com/package/@itsliaaa/baileys)

<p align="center">
   Enhanced Baileys v7 with fixes for newsletter media uploads, plus support for interactive messages, albums, and additional message types.
   <br><br>
   <a href="https://www.npmjs.com/package/@itsliaaa/baileys">
      <img src="https://img.shields.io/npm/v/@itsliaaa/baileys?style=for-the-badge&logo=npm"/>
   </a>
   <a href="https://www.npmjs.com/package/@itsliaaa/baileys">
      <img src="https://img.shields.io/npm/dm/@itsliaaa/baileys?style=for-the-badge&logo=npm"/>
   </a>
   <a href="https://github.com/itsliaaa/baileys">
      <img src="https://img.shields.io/github/stars/itsliaaa/baileys?style=for-the-badge&logo=github"/>
   </a>
   <a href="LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge"/>
   </a>
   <a href="https://nodejs.org">
      <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&labelColor=green&logoColor=white&style=for-the-badge"/>
   </a>
   <a href="#">
      <img src="https://img.shields.io/badge/ESM-only?logo=javascript&labelColor=yellow&logoColor=black&style=for-the-badge"/>
   </a>
</p>

☕ For donation: [Saweria](https://saweria.co/itsliaaa)

### ✨ Highlights

This fork designed for production use with a focus on clarity and safety:

- 🚫 No obfuscation. Easy to read and audit.
- 🚫 No auto-follow channel (newsletter) behavior.

> [!IMPORTANT]
> Hi everyone,
>
> I want to clarify two separate attribution issues regarding packages derived from this fork.
>
> 1. Direct redistribution of my modifications without attribution
>
> The following packages are operated by the same individual under multiple npm accounts:
>
> - [@nuisockets](https://www.npmjs.com/package/@nuisockets/baileys)
> - [@nuiisatoru](https://www.npmjs.com/package/@nuiisatoru/baileys)
> - [@nuiisweetberry](https://www.npmjs.com/package/@nuiisweetberry/baileys)
> - [@nuiisweety](https://www.npmjs.com/package/@nuiisweety/baileys)
>
> These packages redistribute files and modifications originating from this fork while removing contributor credits and modification notes.
>
> 2. Rebranded republishes of this fork
>
> - [@lumina-md](https://www.npmjs.com/package/@lumina-md/baileys)
> - [@sairidev](https://www.npmjs.com/package/@sairidev/baileys-new)
> - [@lordmega/baileys](https://www.npmjs.com/package/@lordmega/baileys)
> - [phantom-baileys](https://www.npmjs.com/package/phantom-baileys)
> - [nexora-baileys](https://www.npmjs.com/package/nexora-baileys)
>
> These packages primarily repackage or republish this fork under different names while failing to preserve proper attribution, credits, or modification notes.
> 
> To be clear, I am **NOT** the original maintainer of Baileys. Full credit and respect belong to:
>
> https://github.com/WhiskeySockets/Baileys
>
> **Forking is completely acceptable. Removing attribution, contributor credits, or modification history is not.**
>
> Please report if necessary.
>
> Thank you. 🤍

> [!NOTE]
> 📄 This project is maintained with limited scope and is not intended to replace upstream Baileys.
>
> 😞 And, really sorry for my bad english.

### 📋 Table of Contents
- [📋 Table of Contents](#-table-of-contents)
- [✨ Highlights](#-highlights)
- [🛠️ Internal Adjustments](#%EF%B8%8F-internal-adjustments)
- [📨 Messages Handling & Compatibility](#-highlights)
- [📨 Messages Handling & Compatibility](#-messages-handling--compatibility)
- [🧩 Additional Message Options](#-additional-message-options)
- [🆕 WhatsApp Protocol Extensions](#-whatsapp-protocol-extensions)
- [📥 Installation](#-installation)
   - [🧩 Import (ESM & CJS)](#-import-esm--cjs)
- [🌐 Connect to WhatsApp (Quick Step)](#-connect-to-whatsapp-quick-step)
@@ -103,7 +103,7 @@
   - [💭 Button Response](#-button-response)
   - [✨ Rich Response](#-rich-response)
   - [🧾 Message with Code Block](#-message-with-code-block)
   - [🌏 Message with Inline Entities](#-message-with-inline-entities)
   - 🌏 [Message with Inline Entities](#-message-with-inline-entities)
   - [📋 Message with Table](#-message-with-table)
   - [🎞️ Status Mention](#%EF%B8%8F-status-mention)
- [📁 Sending Media Messages](#-sending-media-messages)
@@ -149,6 +149,12 @@
   - [👤 Profile Management](#-profile-management)
   - [🛒 Business Management](#-business-management)
   - [🔐 Privacy Management](#-privacy-management)
   - [🆔 Username Management](#-username-management)
   - [🔍 USync Queries](#-usync-queries)
   - [🤝 Interoperability (BirdyChat & Haiket)](#-interoperability-birdychat--haiket)
   - [🔒 Account Security (Password & Passkey)](#-account-security-password--passkey)
   - [👪 Managed Accounts & Payments](#-managed-accounts--payments)
   - [🌐 HTTPS GraphQL (Meta AI & Imagine)](#-https-graphql-meta-ai--imagine)
   - [📡 Events](#-events)
- [🚀 Try the Bot](#-try-the-bot)
- [📦 Fork Base](#-fork-base)
@@ -159,6 +165,11 @@
- 📁 Reintroduced [`makeInMemoryStore`](#%EF%B8%8F-implementing-data-store) with a minimal ESM adaptation and small adjustments for Baileys v7.
- 📦 Switched FFmpeg execution from `exec` to `spawn` for safer process handling.
- 🗃️ Added [`@napi-rs/image`](https://www.npmjs.com/package/@napi-rs/image) as a supported image processing backend in [`getImageProcessingLibrary()`](#%EF%B8%8F-image-processing), offering a balance between performance and compatibility.
- 🪪 Recovered the phone number for LID-addressed senders that arrive without one, so [username](#-username-management) users no longer show up as a bare `@lid`. **[NEW]**
- 📞 Routed top-level call stanzas (`<offer>`, `<terminate>`, …) that arrive outside a `<call>` wrapper, and acknowledged them — previously they were never acked, so the server kept redelivering them. **[NEW]**
- 🤖 Decrypted `msmsg` Meta AI bot replies instead of dropping them. The `messageSecret` is captured at send time and recovered from `getMessage` after a restart. **[NEW]**
- 🔍 Parsed the USync fields that were previously left as TODOs: per-protocol errors with backoff, cache `refresh` hints, `side_list`, per-contact privacy tokens, and blocked-by-contact detection. **[NEW]**
- 🆔 Fixed the USync username parser, which returned `null` for the `Uint8Array` payloads the binary decoder actually produces. **[NEW]**

### 📨 Messages Handling & Compatibility
- 📩 Expanded messages support for:
@@ -169,7 +180,7 @@
   - 📦 [Sticker Pack Message](#-sticker-pack)
   - ✨ [Rich Response Message](#-rich-response) **[NEW]**
   - 🧾 [Message with Code Blocks](#-message-with-code-block) **[NEW]**
   - [🌏 Message with Inline Entities](#-message-with-inline-entities) **[NEW]**
   - 🌏 [Message with Inline Entities](#-message-with-inline-entities) **[NEW]**
   - 📋 [Message with Table](#-message-with-table) **[NEW]**
   - 💳 [Payment-related Message](#-sending-payment-messages) (payment requests, invites, orders, invoices).
- 📰 Simplified sending messages with ad thumbnail using [`externalAdReply`](#-external-ad-reply), without requiring manual `contextInfo`.
@@ -183,6 +194,28 @@
   - 🔧 [`ephemeral`](#-ephemeral), [`groupStatus`](#%E2%80%8D%E2%80%8D-group-status), [`isLottie`](#-lottie-sticker), [`spoiler`](#-spoiler), [`viewOnce`](#%EF%B8%8F-view-once), [`viewOnceV2`](#%EF%B8%8F-view-once-v2), [`viewOnceV2Extension`](#%EF%B8%8F-view-once-v2-extension), [`interactiveAsTemplate`](#%EF%B8%8F-interactive) - Message wrappers
   - 🔒 [`secureMetaServiceLabel`](#%EF%B8%8F-secure-meta-service-label) - Secure meta service label on message **[NEW]**
   - 📄 [`raw`](#-raw) - Build your message manually **(DO NOT USE FOR EXPLOITATION)**
   - 🎞️ [`statusPrivacy`](#%EF%B8%8F-status-mention) - Control who receives a status broadcast (`contacts` | `allowlist` | `denylist`) **[NEW]**

### 🆕 WhatsApp Protocol Extensions

Support for WhatsApp features that upstream Baileys does not expose yet. **[NEW]**

| Feature | What it does | Reference |
| --- | --- | --- |
| 🆔 **Username** | Look up accounts by `@username`, and claim / change / remove your own | [Username Management](#-username-management) |
| 🔍 **USync protocols** | Business profile, profile picture, About text, side list, and device feature queries | [USync Queries](#-usync-queries) |
| 🔐 **MEX privacy** | Privacy settings, contact allow/deny lists, About text, contact integrity checks | [Privacy Management](#-privacy-management) |
| 🤝 **Interoperability** | Cross-platform chats and groups with BirdyChat and Haiket | [Interoperability](#-interoperability-birdychat--haiket) |
| 🔒 **Account security** | Account password and passkey (FIDO2 / WebAuthn) management | [Account Security](#-account-security-password--passkey) |
| 👪 **Managed accounts** | Parental / family account linking, payments passkey, UPI onboarding | [Managed Accounts](#-managed-accounts--payments) |
| 🌐 **HTTPS GraphQL** | Meta AI memory, Imagine image/video generation, AI personas, events, payments | [HTTPS GraphQL](#-https-graphql-meta-ai--imagine) |
| 🤖 **Meta AI decryption** | Decrypts `msmsg` (`messageSecret`-encrypted) Meta AI bot replies | — |
| 📞 **Call details** | `callKey` (raw SRTP key), audio/video codecs, group roster, call-link waiting room | [Events](#-events) |
| 📰 **Newsletter status** | `newsletter.status` event for server-pushed channel posts, with engagement counters | [Events](#-events) |
| 🪪 **LID fallback** | Recovers the phone number for senders who only expose a `@lid` (e.g. username users) | [WhatsApp IDs Explain](#-whatsapp-ids-explain) |

> [!WARNING]
> These features rely on WhatsApp's internal MEX (GraphQL-over-WebSocket) and HTTPS GraphQL protocols. The numeric query IDs were captured from a specific WhatsApp client version and **may stop working after a WhatsApp update** — a rejected query usually means the ID is stale, not that the code is broken.

### 📥 Installation

@@ -364,6 +397,11 @@
- For broadcast lists, it's `[timestamp of creation]@broadcast`.
- For stories, the ID is `status@broadcast`.

> [!IMPORTANT]
> Senders who set a WhatsApp [username](#-username-management) arrive LID-addressed, and WhatsApp sends **no** phone number alongside them. This fork recovers the phone number from the local LID↔PN mapping and fills in `key.remoteJidAlt` (or `key.participantAlt` in groups). **[NEW]**
>
> That recovery only works once a mapping exists — from history sync, group metadata, or an earlier chat. On a first-ever contact from a username user there is genuinely no phone number to recover, so **handle `@lid` natively** rather than assuming a phone number is always available.

### ✉️ Sending Messages

> [!NOTE]
@@ -849,6 +887,19 @@
})
```

Pass `statusPrivacy` to control who receives a status broadcast. **[NEW]**

```javascript
sock.sendMessage('status@broadcast', {
   text: 'Hello! 👋🏻'
}, {
   statusPrivacy: 'contacts' // 'contacts' | 'allowlist' | 'denylist'
})
```

> [!NOTE]
> The allow and deny lists themselves are managed separately, via [`updatePrivacyContactList`](#-privacy-management).

### 📁 Sending Media Messages

> [!NOTE]
@@ -2005,6 +2056,356 @@
sock.updateDisableLinkPreviewsPrivacy(true)
```

The methods above use plain IQ stanzas. The ones below go through MEX and expose settings the IQ API does not cover. **[NEW]**

> [!NOTE]
> MEX feature and setting values are lowercase and case-sensitive on the wire.
>
> Features: `last`, `online`, `profile`, `status`, `readreceipts`, `groupadd`, `groupcreation`, `calladd`, `defense`.
> Settings: `all`, `contacts`, `contact_blacklist`, `none` — except `online` (`all` | `match_last_seen`), `calladd` (`all` | `contacts` | `known`), and `defense` (`off` | `on_standard`).

```javascript
// --- Read every privacy setting for your own account
const settings = await sock.getPrivacySettings(sock.user.id)

// --- Change a privacy setting
await sock.setPrivacySetting('last', 'contacts')
await sock.setPrivacySetting('defense', 'on_standard')

// --- Manage the allow/deny list attached to a setting
await sock.getPrivacyContactList('groupadd', 'contact_blacklist')
await sock.updatePrivacyContactList('groupadd', 'contact_blacklist', [
   '6281111111111@s.whatsapp.net'
])

// --- About text (your own, and other people's)
await sock.updateTextStatus('Available for chats 👋')
const abouts = await sock.getTextStatusList(['6281111111111@s.whatsapp.net'])

// --- Only return About texts newer than a timestamp
await sock.getTextStatusList(jids, Date.now() - 24 * 60 * 60 * 1000)

// --- Verify a JID is reachable before opening a chat
const check = await sock.contactIntegrityQuery(['6281111111111@s.whatsapp.net'])
const bizCheck = await sock.bizIntegrityQuery(['6281111111111@s.whatsapp.net'])

// --- Profile picture
const info = await sock.fetchUserPictureInfo('6281111111111@s.whatsapp.net')
await sock.setProfilePictureMex(imageBase64, 'image')   // full resolution
await sock.setProfilePictureMex(imageBase64, 'preview') // thumbnail

// --- Linked social profiles (FB & IG)
await sock.linkedProfilesSet([{ type: 'IG', username: 'someone' }])
await sock.linkedProfilesUpdate([{ type: 'IG', showOnProfile: true }])
await sock.linkedProfilesRemove(['IG'])

// --- Trusted devices
const devices = await sock.getTrustedDevices()
await sock.addTrustedDevice(deviceId, 'My Laptop')
await sock.untrustTrustedDevice(deviceId)
await sock.deleteTrustedDevice(deviceId)

// --- Misc
await sock.fetchMobileConfig()
await sock.migrateBlocklistLid(['6281111111111@s.whatsapp.net'])

// --- Raw query IDs, if you need to build a query yourself
sock.PRIVACY_MEX_IDS
```

#### 🆔 Username Management

WhatsApp usernames (`@username`) let people be found without sharing a phone number. **[NEW]**

> [!NOTE]
> Usernames are looked up over USync, while your own username is managed over MEX. Pass the username **without** the leading `@` — a leading `@` is stripped for you.

```javascript
// --- Look up accounts by username
const results = await sock.onWhatsAppUsername('someusername')

console.log('🆔 Got user', ':', results)

// --- Output
// [
//    {
//       username: 'someusername',
//       jid: '43411111111111@lid',
//       exists: true
//    }
// ]

// --- Look up several at once, with a PIN for protected usernames
await sock.onWhatsAppUsername(
   'someusername',
   { username: 'protectedname', usernameKey: '1234' }
)

// --- Fetch the username of one or more JIDs
const usernames = await sock.fetchUsername('6281111111111@s.whatsapp.net')

console.log('🆔 Got username', ':', usernames)

// --- Output
// [
//    {
//       jid: '6281111111111@s.whatsapp.net',
//       username: 'someusername'
//    }
// ]
// --- username is undefined when the account has none set
```

Managing your own username is a two-step flow — check availability first, then claim it with the `session_id` returned by the check.

```javascript
// --- Step 1: check availability
const check = await sock.checkUsername('myusername')

if (!check.available) {
   console.log('🆔 Taken. Try', ':', check.suggestions)
   console.log('🆔 Rejected because', ':', check.rejectionReasons)
   return
}

// --- Step 2: claim it, reusing the session_id from the check
await sock.setUsername('myusername', {
   sessionId: check.session_id
})

// --- Claim one of the server's suggestions
await sock.setUsername(check.suggestions[0], {
   source: 'SUGGESTION',
   sessionId: check.session_id
})

// --- Claim with a PIN protecting it
await sock.setUsername('myusername', {
   pin: '1234'
})

// --- Read your own username
const mine = await sock.getMyUsername()

// --- Change or remove the PIN
await sock.setUsernamePin('1234')
await sock.setUsernamePin(null)

// --- Remove your username entirely
await sock.deleteUsername()
```

#### 🔍 USync Queries

USync fetches user data in bulk. Chain the protocols you need onto a single query. **[NEW]**

```javascript
import { USyncQuery, USyncUser } from '@itsliaaa/baileys'

// --- Business profile, profile picture, and About text in one round trip
const query = new USyncQuery()
   .withBusinessProtocol()
   .withPictureProtocol('preview')
   .withTextStatusProtocol()
   .withUser(new USyncUser().withId('6281111111111@s.whatsapp.net'))

const result = await sock.executeUSyncQuery(query)

console.log('🔍 Got data', ':', result.list)

// --- Device feature flags
const features = new USyncQuery()
   .withFeatureProtocol(['voip', 'encrypt_v2'])
   .withUser(new USyncUser().withId('6281111111111@s.whatsapp.net'))

await sock.executeUSyncQuery(features)
```

| Protocol | Returns |
| --- | --- |
| `withBusinessProtocol(profileVersion?)` | Verified name and level, business hours, address, catalog and cart flags |
| `withPictureProtocol(type?)` | Picture `id`, `directPath`, and `hash` — `'image'` (default) or `'preview'` |
| `withTextStatusProtocol()` | About `text`, `emoji`, `setAt`, and `expiresAt` |
| `withSidelistProtocol(useLidAddressing?)` | Side-list entries, returned in `result.sideList` |
| `withFeatureProtocol(features?)` | Device feature flags — defaults to all known features |

The query result also carries per-protocol diagnostics:

```javascript
const result = await sock.executeUSyncQuery(query)

result.list       // matched users
result.sideList   // side-list users, when the sidelist protocol was requested
result.errors     // { [protocol]: { errorCode, errorText, errorBackoff } }
result.refresh    // { [protocol]: seconds } — how long the response stays cacheable

// A contact who blocked you is flagged instead of throwing
result.list[0].isBlockedByContact
```

> [!TIP]
> When `result.errors` carries an `errorBackoff`, wait at least that many seconds before repeating the same protocol — otherwise the server keeps rejecting it.

#### 🤝 Interoperability (BirdyChat & Haiket)

Chat with users on third-party platforms that WhatsApp has opened up to. **[NEW]**

```javascript
// --- List the integrators the server offers
const integrators = await sock.fetchIntegrators()

console.log('🤝 Got integrators', ':', integrators)

// --- Opt in (accepts the interop TOS and opts in, in one call)
await sock.initInterop()

// --- Or opt in and out manually
await sock.acceptInteropTOS()
await sock.optInIntegrators([sock.INTEGRATOR_BIRDYCHAT])
await sock.optOutIntegrators([sock.INTEGRATOR_HAIKET])

// --- Resolve an interop identifier into a JID
const user = await sock.resolveInteropUser('someone@example.com')
const users = await sock.resolveInteropUsers(['6281111111111'])

// --- Interop groups
await sock.createInteropGroup(subject, participants)
await sock.addParticipantsToInteropGroup(groupJid, participants)
await sock.queryInteropGroupInfo(groupJid)
await sock.leaveInteropGroup(groupJid)

// --- Moderation & privacy
await sock.blockInteropUser(jid)
await sock.unblockInteropUser(jid)
await sock.reportInteropSpam(jid)
await sock.trustInteropContact(jid)
await sock.getReachabilitySettings()
await sock.queryInteropPrivacySettings()
await sock.updateInteropPrivacySetting(feature, setting)

// --- Force a fresh Signal session on the next send
await sock.resetInteropSession(jid)
```

> [!NOTE]
> `INTEGRATOR_BIRDYCHAT` identifies users by email, `INTEGRATOR_HAIKET` by phone number.

#### 🔒 Account Security (Password & Passkey)

Account-level password and passkey (FIDO2 / WebAuthn) management. **[NEW]**

> [!CAUTION]
> These change the security settings of the WhatsApp account itself, not just this session. Losing a password or passkey you set here can lock you out of the account.

```javascript
// --- Password
const { has_password } = await sock.hasPassword()
await sock.setPassword('my-secure-password')
await sock.setPassword('new-password', 'old-password')
await sock.checkPassword('my-secure-password')
await sock.deletePassword('my-secure-password')

// --- Passkey
const exists = await sock.passkeyExists()
const list = await sock.passkeyListExists()
const challenge = await sock.passkeyRequestChallenge()
await sock.passkeyVerifyChallenge(credentialId, authenticatorData, clientDataJson, signature)
await sock.passkeyDelete(credentialId)

// --- Contacts backup
await sock.contactsUpload(contacts)
await sock.contactsBackup(contacts)
await sock.contactsBackupQuery()
await sock.selfContactsQuery()

// --- Misc account
await sock.getWaMeLink()
await sock.userCountryCodeGet()
await sock.removeAccountReachoutTimelock()
await sock.fetchUserNoticesById(noticeIds)

// --- Raw query IDs
sock.REGISTRATION_MEX_IDS
```

#### 👪 Managed Accounts & Payments

Parental / family account linking, payments passkey, and UPI onboarding. **[NEW]**

```javascript
// --- Managed (supervised) accounts
await sock.managedAccountQuery(jid)
await sock.managedAccountInitiateLinking('6281111111111')
await sock.managedAccountValidateLinking(linkingToken, sponsorJid)
await sock.managedAccountAcceptLinking(linkingToken)
await sock.managedAccountCompleteLinking(linkingToken)
await sock.managedAccountRevokeLinking(sponsoredJid)
await sock.managedAccountSyncActivities(jid)
await sock.managedAccountUpdatePin(pin)

// --- Payments passkey
await sock.paymentsPasskeyHasCredential()
await sock.paymentsPasskeyEnrollChallenge()
await sock.paymentsPasskeyEnrollVerify(credential)
await sock.paymentsPasskeyToggleOn()
await sock.paymentsPasskeyToggleOff()
await sock.paymentsIsAccountRecoverable()

// --- UPI onboarding (India)
await sock.upiSendOtp(phoneNumber)
await sock.upiVerifyOtp(phoneNumber, otp)

// --- Raw query IDs
sock.MANAGED_ACCOUNT_MEX_IDS
```

#### 🌐 HTTPS GraphQL (Meta AI & Imagine)

Meta AI, Imagine, events, and payments run over HTTPS GraphQL rather than the WebSocket. **[NEW]**

> [!IMPORTANT]
> These calls need an ACS access token. `acquireAccessToken()` fetches one for you on the first call (nonce → exchange) and caches it, so you normally do not have to do anything. Pass your own with `setAccessToken()` if you already have one.

```javascript
// --- Token handling (optional — acquired on demand otherwise)
await sock.acquireAccessToken()
sock.setAccessToken(token)
sock.setWamoAuth(auth, host)

// --- Meta AI memory
await sock.metaAiMemoryQuery()
await sock.metaAiMemoryDelete(memoryId)
await sock.metaAiMemoryDeleteAll()
await sock.metaAiMemoryOptOutStatus()
await sock.metaAiMemoryOptOutUpdate(true)

// --- Imagine (image & video generation)
await sock.imagineIntents('a cat wearing sunglasses')
await sock.imagineEdit(imageId, 'make it night time')
await sock.imagineExpand(imageId, 'left')
await sock.imagineGenerateAnimate(imageId)
await sock.imagineVideoStatus(jobId)

// --- AI personas
await sock.aiHomeFetchUserCreatedPersonas()
await sock.aiCreationUpdatePersona(botId, updates)
await sock.aiCreationDeletePersona(botId)

// --- Raw executors, for queries not wrapped above
await sock.executeWWWGraphQL(docId, variables, token, dataPath)
await sock.executeFacebookGraphQL(docId, variables, token, dataPath)
await sock.executeWamoGraphQL(docId, variables, wamoAuth, dataPath, wamoHost)

// --- Raw doc ID dictionaries
sock.WWW_GQL_IDS
sock.FACEBOOK_GQL_IDS
sock.WAMO_GQL_IDS
sock.CLIENT_PERSIST_GQL_IDS
```

> [!WARNING]
> These calls leave the WhatsApp WebSocket and hit Meta's HTTPS endpoints directly. They have no built-in timeout, so wrap them in your own if a hung request would stall your bot.

#### 📡 Events

```javascript
@@ -2038,39 +2439,100 @@
sock.ev.on('labels.association', (update) => {})
sock.ev.on('newsletter.reaction', (update) => {})
sock.ev.on('newsletter.view', (update) => {})
sock.ev.on('newsletter.status', (update) => {}) // [NEW]
sock.ev.on('newsletter-participants.update', (update) => {})
sock.ev.on('newsletter-settings.update', (update) => {})
sock.ev.on('settings.update', (update) => {})
```

##### 📰 `newsletter.status`

Fires for channel (newsletter) posts pushed by the server, carrying the post content alongside its engagement counters. **[NEW]**

```javascript
sock.ev.on('newsletter.status', (update) => {
   console.log('📰 Newsletter post', ':', update)
})

// --- Output
// {
//    id: '120111111111111111@newsletter',
//    messageId: '3A4E0CA0AEF807976D5B',
//    serverId: 42,
//    timestamp: 1785923027,
//    isSender: false,
//    viewsCount: 128,
//    responsesCount: 7,
//    reactionCounts: [
//       { code: '👍', count: 12 }
//    ],
//    meta: {
//       editedAt: 1785923100,
//       originalTimestamp: 1785923027
//    },
//    content: {
//       type: 'text',
//       message: { conversation: 'Hello from the channel!' }
//    }
// }
```

`content.type` is one of `text`, `media` (with an extra `mediaType`), `reaction` (with a `code`), or `revoke`. It is `null` when the stanza carries only counter updates.

##### 📞 `call`

The call event now carries the full signalling payload. **[NEW]**

```javascript
sock.ev.on('call', ([call]) => {
   console.log('📞 Call', ':', call)
})
```

| Field | Present when | Description |
| --- | --- | --- |
| `callKey` | `status: 'offer'` | Raw SRTP key bytes, Signal-decrypted from the offer |
| `audioCodecs`, `audioCodec` | `status: 'offer'` | Offered audio codecs, one entry per sample rate |
| `videoCodec` | `status: 'offer'` | Offered video codec |
| `isLightweight` | `status: 'offer'` | Silent / wave-style group ring — no full ringing UX expected |
| `silenceReason` | `status: 'offer'` | Why the call was silenced |
| `peerJid` | `status: 'waiting_room_request'` | Who is waiting in a call link's waiting room |
| `participants` | `status: 'group_info'` | Group call roster, with per-user devices |
| `muted` | `status: 'mute'` | Mute state of the peer |
| `enabled` | `status: 'video_state'` | Whether the peer's video is on |
| `state` | `status: 'peer_state'` | Peer connection state |
| `latencyMs` | `status: 'relaylatency'` | Relay latency |

`status` can also be a specific end-call reason instead of a bare `terminate`: `timeout`, `reject_do_not_disturb`, `mic_permission_denied`, `camera_permission_denied`, `remote_busy`, or `remote_offline`.

### 🚀 Try the Bot

A fast, lightweight, and modular WhatsApp bot built with [@itsliaaa/baileys](https://www.npmjs.com/package/@itsliaaa/baileys).
Perfect for managing groups, moderating chats, and adding fun with quiz games and handy tools.

👉🏻 [@itsliaaa/starseed](https://github.com/itsliaaa/starseed#readme)

A lightweight yet powerful Baileys wrapper designed to simplify development while extending support for additional message types and WhatsApp features.

👉🏻 [@itsliaaa/starcore](https://www.npmjs.com/package/@itsliaaa/starcore)

### 📦 Fork Base

This fork is based on [Baileys (GitHub)](https://github.com/WhiskeySockets/Baileys)

### 📣 Credits

This fork uses Protocol Buffer definitions maintained by [WPP Connect](https://github.com/wppconnect-team) via [`wa-proto`](https://github.com/wppconnect-team/wa-proto)

Full credit is attributed to the original maintainers and contributors of Baileys:
- [purpshell](https://github.com/purpshell)
- [jlucaso1](https://github.com/jlucaso1)
- [adiwajshing](https://github.com/adiwajshing)


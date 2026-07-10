# EchoSphere AI --- What We Learned Today

## 1. Core Architectural Shift

We moved from `PeerConnection -> Audio` to
`User -> Network + Audio + World State`.

A remote user is now the central entity:

``` javascript
users[userId] = {
    id: userId,
    peerConnection,
    audio,
    position,
    pendingIceCandidates
};
```

This makes the system extensible for avatars, mute state, movement,
profiles, and future features.

## 2. One PeerConnection Is Not a Whole Room

A single `RTCPeerConnection` represents one WebRTC relationship.

``` text
You
├── PeerConnection -> Alice
├── PeerConnection -> Bob
└── PeerConnection -> Charlie
```

We refactored from one global connection to one connection per remote
user.

## 3. User Management

We introduced `createUser(userId)` to create complete state for one
remote user, and `ensureUser(userId)` to return an existing user or
create one.

Key lesson: manage state around the user, not isolated technical
objects.

## 4. One AudioContext, Multiple Audio Branches

We use one shared `AudioContext` and a separate audio branch per remote
user:

``` text
                AudioContext
                     |
        ---------------------------
        |            |            |
      Alice         Bob        Charlie
        |            |            |
      Source       Source       Source
        |            |            |
       Gain         Gain         Gain
        |            |            |
      Panner       Panner       Panner
        |            |            |
        -------- Speakers --------
```

Key lesson: one world = one AudioContext; one remote user = one audio
graph branch.

## 5. Spatial Audio Pipeline

Each remote stream becomes:

``` text
Remote WebRTC Track
        |
        v
MediaStreamAudioSourceNode
        |
        v
GainNode
        |
        v
PannerNode
        |
        v
Speakers
```

-   SourceNode brings WebRTC audio into Web Audio.
-   GainNode controls volume.
-   PannerNode creates 3D spatial positioning.
-   AudioContext destination outputs to speakers.
-   HRTF gives more realistic directional audio.

## 6. Position Is World State

Canonical `(x, y, z)` belongs to the user/player:

``` javascript
user.position = { x: 0, y: 0, z: 0 };
```

Then systems consume it:

``` text
player.position
      |
      +--> Three.js avatar
      +--> PannerNode
      +--> Network updates
      +--> Future physics
```

Key lesson: PannerNode uses position; it should not own the world's
source of truth.

## 7. Audio and Position Travel Differently

WebRTC carries continuous real-time microphone audio.

Socket.IO carries signaling and metadata: - join/leave events - offers -
answers - ICE candidates - future position updates

Key lesson: do not send microphone audio through Socket.IO.

## 8. Targeted Signaling

We moved away from blindly broadcasting signaling messages.

Example:

``` javascript
socket.emit("offer", {
    targetId: peerId,
    offer
});
```

The server forwards it only to the intended socket. The same targeted
pattern applies to offers, answers, and ICE candidates.

## 9. Why senderId Matters

Incoming messages must map back to the correct remote entity:

``` javascript
{
    senderId,
    offer
}
```

Then:

``` javascript
users[senderId].peerConnection
```

Key lesson: multi-user network messages must map to the correct entity.

## 10. Per-User ICE Handling

An ICE candidate belongs to a specific WebRTC connection. ICE sending
moved inside `createPeerConnection(userId)`.

``` text
PC for Bob
   |
   v
ICE candidate
   |
   v
targetId = Bob
```

We also learned how closures let event handlers retain `userId`.

## 11. ICE Race Conditions

ICE candidates can arrive before remote SDP is ready. We introduced:

``` javascript
pendingIceCandidates: []
```

If remote description is missing, queue the candidate. After
`setRemoteDescription()`, call:

``` javascript
flushPendingIceCandidates(userId);
```

Key lesson: real-time systems must handle event ordering, not only the
happy path.

## 12. Offer Flow

``` text
peer-joined(peerId)
        |
        v
ensureUser(peerId)
        |
        v
Get user's PeerConnection
        |
        v
Attach local microphone tracks
        |
        v
createOffer()
        |
        v
setLocalDescription()
        |
        v
Send targeted offer
```

## 13. Answer Flow

``` text
Receive { senderId, offer }
        |
        v
ensureUser(senderId)
        |
        v
Get sender's dedicated PC
        |
        v
Attach local microphone tracks
        |
        v
setRemoteDescription(offer)
        |
        v
Flush queued ICE
        |
        v
createAnswer()
        |
        v
setLocalDescription(answer)
        |
        v
Send targeted answer
```

The original offerer applies the answer to
`users[senderId].peerConnection`.

## 14. ontrack Belongs to the Per-User Connection

`ontrack` moved inside `createPeerConnection(userId)`.

``` text
Track arrives on Bob's PC
        |
        v
Track belongs to Bob
        |
        v
Create Bob's audio pipeline
        |
        v
users[Bob].audio = pipeline
```

Key lesson: preserve identity from network connection to audio pipeline.

## 15. User Lifecycle and Cleanup

When a user leaves:

``` text
User leaves
    |
    v
Disconnect audio nodes
    |
    v
Close PeerConnection
    |
    v
Delete user state
```

`removeUser(userId)` prevents stale connections and resource leaks.

## 16. Mesh Architecture and Scaling

Current architecture is mesh. For `N` users, pairwise relationships grow
roughly as:

``` text
N(N - 1) / 2
```

Rooms organize users, but rooms alone do not solve mesh bandwidth
scaling.

## 17. SFU Architecture

We discussed a future SFU (Selective Forwarding Unit):

``` text
          SFU
       /   |   \
   Alice  Bob  Charlie
```

Important for EchoSphere: keep separate remote tracks per user so every
voice can have its own GainNode and PannerNode.

Potential future technologies: - mediasoup - LiveKit - Janus

Decision: finish and validate the mesh milestone before pivoting to SFU.

## 18. Separation of Concerns

``` text
Socket.IO
  -> signaling, rooms, metadata

WebRTC
  -> real-time microphone transport

Web Audio API
  -> gain and spatial audio processing

Future Three.js
  -> visual world and movement
```

Rules: - Three.js does not transport audio. - WebRTC does not own world
position. - Socket.IO does not carry microphone audio. - PannerNode does
not own canonical player position.

## 19. Clean Codebase Baseline

Client sections: 1. Configuration 2. Shared Application State 3. User
Management 4. Web Audio Pipeline 5. Peer Connection Factory 6. Local
Microphone 7. ICE Queue Management 8. Application Startup 9. Peer Joined
-\> Offer 10. Receive Offer -\> Answer 11. Receive Answer 12. Receive
ICE 13. User Left Cleanup

Server sections: 1. Dependencies 2. Server Setup 3. Socket Connection 4.
Join Room 5. Route Offer 6. Route Answer 7. Route ICE 8. Disconnect
Cleanup 9. Start Server

Key lesson: comments should explain why a block exists, not repeat
syntax.

## 20. What We Achieved Today

-   User-centric state architecture
-   `createUser(userId)`
-   `ensureUser(userId)`
-   `removeUser(userId)`
-   One PeerConnection per remote user
-   One shared AudioContext
-   One spatial audio branch per remote user
-   Targeted offer routing
-   Targeted answer routing
-   Targeted ICE routing
-   Sender identity mapping
-   Pending ICE queues
-   Per-user `ontrack`
-   User cleanup lifecycle
-   Clean commented `app.js`
-   Clean commented `server.js`
-   Clear understanding of mesh vs SFU
-   A roadmap balancing learning and shipping

## 21. What Is Left

Immediate validation: - Test clean baseline with 2 tabs - Test with 3
tabs - Confirm each tab sees two remote users - Inspect
`Object.keys(users)` - Verify each user has its own PeerConnection -
Verify each user gets its own audio pipeline - Close one tab and verify
cleanup - Fix only observed bugs

Near-term: - Duplicate-track protection - Duplicate `addTrack`
protection - Reconnect handling - Basic room UI - Connected-user
display - Mute/unmute - Position update protocol - Dynamic PannerNode
updates - Listener position/orientation - Minimal Three.js world -
Avatar movement - Position interpolation

Later: - HTTPS deployment - TURN server - NAT/firewall reliability -
Authentication - Persistent identity - SFU evaluation/migration - AI
features after the core spatial voice experience works

## 22. Biggest Takeaway

The biggest lesson was the architectural shift:

``` text
Before:

PeerConnection
    |
    v
Audio


After:

User
 |
 +-- Identity
 |
 +-- Network
 |     \-- PeerConnection
 |
 +-- Audio
 |     +-- Source
 |     +-- Gain
 |     \-- Panner
 |
 \-- World
       \-- Position
```

This is what allows EchoSphere to grow from a two-tab experiment into a
multi-user spatial voice system.

## Next Session

Validate the clean mesh baseline first. Do not add Three.js or migrate
to an SFU until current multi-user behavior is proven with real tests.

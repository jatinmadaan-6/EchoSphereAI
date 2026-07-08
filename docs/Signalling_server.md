
# EchoSphere AI — Day 4 Summary (Offer/Answer Negotiation)

## Objective
Today we connected the Web Audio concepts from previous sessions with the first phase of WebRTC signaling. The focus was not on completing a voice call, but on understanding *why* every API exists before using it.

## Concepts Learned

### 1. RTCPeerConnection is a Connection Manager
Creating:
```javascript
const peerConnection = new RTCPeerConnection({...});
```
does **not** establish a connection. It creates an object responsible for:
- SDP negotiation
- ICE gathering
- DTLS/SRTP security
- Media track management
- Connection state

### 2. MediaStream vs MediaStreamTrack
A `MediaStream` is a container, while `MediaStreamTrack` objects carry the actual media.

We inspected:
- `stream`
- `stream.getTracks()`

and understood why WebRTC transmits tracks instead of streams.

### 3. Why addTrack(track, stream)?
The browser needs:
- the **track** (actual media)
- the **stream** (logical grouping)

This allows the receiving browser to reconstruct the original MediaStream.

### 4. Adding Media Before Negotiation
We learned that media tracks must be added **before** calling `createOffer()` because the SDP advertises the media the browser intends to send.

Pipeline:

Microphone
↓
MediaStream
↓
MediaStreamTrack
↓
RTCPeerConnection

### 5. SDP Offer
Generated our first SDP:

```javascript
const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);
```

We inspected the SDP instead of blindly forwarding it.

We decoded:
- `v=`
- `o=`
- `s=`
- `t=`
- `a=group:BUNDLE`
- `m=audio`
- `a=sendrecv`
- `a=rtpmap:111 opus/48000/2`

### 6. Why the Signaling Server Exists
A WebRTC connection does not exist yet when the offer is created.

Therefore:

Browser A
↓
Socket.io
↓
Signaling Server
↓
Socket.io
↓
Browser B

The signaling server simply forwards messages.

It does **not**:
- interpret SDP
- create answers
- negotiate codecs

### 7. Offer / Answer Flow
Implemented the complete signaling flow (without ICE):

Browser A:
- createOffer()
- setLocalDescription()
- socket.emit("offer")

Server:
- forwards offer

Browser B:
- setRemoteDescription()
- createAnswer()
- setLocalDescription()
- socket.emit("answer")

Server:
- forwards answer

Browser A:
- setRemoteDescription()

### 8. Architectural Understanding
Key realization:

The signaling server is **only** the communication channel that exists before WebRTC.

Once negotiation completes, the browsers communicate directly.

## Code Completed

### app.js
Implemented:
- RTCPeerConnection
- getUserMedia()
- addTrack()
- createOffer()
- setLocalDescription()
- offer emission
- offer reception
- createAnswer()
- answer emission
- answer reception
- setRemoteDescription()

### server.js
Implemented forwarding for:
- join-room
- peer-joined
- offer
- answer

The server behaves as a generic message relay.

## What Was NOT Implemented
- ICE candidate exchange
- addIceCandidate()
- ontrack
- Remote MediaStream
- Audio playback
- Spatial audio integration

## Current Architecture

Browser A
↓
Microphone
↓
MediaStream
↓
Tracks
↓
RTCPeerConnection
↓
Offer
↓
Socket.io
↓
Server
↓
Socket.io
↓
Browser B
↓
Remote Description
↓
Answer
↓
Socket.io
↓
Server
↓
Socket.io
↓
Browser A

## Biggest Takeaways
- Understand the engineering problem before the API.
- RTCPeerConnection is a stateful connection manager.
- Tracks are transmitted, streams preserve grouping.
- SDP is a negotiation document, not media.
- The signaling server forwards messages only.
- Offer/Answer negotiation must complete before ICE can establish connectivity.

## Next Session
We will implement:
1. onicecandidate
2. ICE candidate forwarding through Socket.io
3. addIceCandidate()
4. Watch ICE state transitions
5. Establish the first successful peer-to-peer connection.

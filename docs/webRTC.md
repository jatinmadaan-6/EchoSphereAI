# WebRTC

## What is WebRTC?

**WebRTC (Web Real-Time Communication)** is a technology used to establish real-time communication between two users (peers/hosts) directly through their browsers or applications.

Common use cases include:

* Voice calls
* Video calls
* Live streaming
* Real-time data transfer

---

## Why Does WebRTC Use UDP?

WebRTC primarily uses **UDP (User Datagram Protocol)** because:

* It is faster than TCP.
* Low latency is critical for audio and video communication.
* Occasional packet loss is acceptable in real-time communication.
* Waiting for retransmissions (as TCP does) would introduce noticeable delays.

---

## Public IP Addresses and NAT Traversal

For two devices to communicate over the internet, they need to discover each other's reachable network addresses.

However, devices are often behind routers using **NAT (Network Address Translation)**.

### STUN and TURN Servers

WebRTC uses:

* **STUN (Session Traversal Utilities for NAT)** servers to discover a device's public IP address.
* **TURN (Traversal Using Relays around NAT)** servers to relay traffic when a direct peer-to-peer connection cannot be established.

These services work together through the **ICE (Interactive Connectivity Establishment)** framework.

### ICE

ICE gathers all possible connection candidates (IP addresses and ports) and determines the best path between peers.

---

## Signaling

Before peers can communicate, they must exchange connection information.

### Session Description Protocol (SDP)

An **SDP (Session Description Protocol)** contains information such as:

* Supported audio/video codecs
* Media capabilities
* Network information
* Connection parameters

### Signaling Process

1. Peer A creates an SDP offer.
2. The offer is sent through a signaling server (commonly using WebSockets, Socket.IO, etc.).
3. Peer B receives the offer and creates an SDP answer.
4. ICE candidates are exchanged.
5. Once negotiation is complete, a direct peer-to-peer connection is established.

After the connection is established, the signaling server is no longer required for media transfer.

---

## Moving Beyond Pure Peer-to-Peer

### Mesh Architecture

In a mesh architecture:

* Every participant establishes a connection with every other participant.
* For `n` participants, each user maintains `n - 1` connections.

Example:

For 5 participants:

* Each participant maintains 4 connections.
* Total connections = 10.

#### Problems with Mesh

* High bandwidth consumption
* Increased CPU usage
* Poor scalability
* Difficult to support large meetings

---

## SFU (Selective Forwarding Unit)

Modern video conferencing applications typically use an **SFU** instead of a pure mesh network.

### How an SFU Works

1. Each participant establishes a WebRTC connection with the SFU.
2. The SFU receives media streams from all participants.
3. Instead of mixing streams, the SFU selectively forwards streams to the appropriate participants.
4. Each client receives the streams needed to render the conference layout (grid view, speaker view, etc.).

### Advantages

* Scales much better than mesh architecture.
* Reduces bandwidth requirements for clients.
* Lower CPU usage on participant devices.
* Suitable for large meetings and conferences.

### Architecture

```text
        User A
           |
           |
        +------+
        | SFU  |
        +------+
       /   |   \
      /    |    \
 User B  User C  User D
```

The SFU acts as a central forwarding server while maintaining WebRTC connections with all participants.

---

## Summary

* WebRTC enables real-time communication between peers.
* It primarily uses UDP for low-latency transmission.
* STUN, TURN, and ICE help establish connectivity across the internet.
* SDP is exchanged through a signaling server to negotiate connections.
* Once connected, peers communicate directly.
* Pure P2P mesh architectures do not scale well.
* Modern systems use an SFU to efficiently forward media streams between participants.

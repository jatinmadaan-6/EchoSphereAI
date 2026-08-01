// ============================================================
// ECHOSPHERE AI — CLIENT
// ============================================================
import { createAvatar, removeAvatar, updateAvatarPosition } from "./world/avatar.js";
import { initWorld } from "./world/world.js";
//
// Current architecture:
//
// Socket.IO  -> signaling and room events
// WebRTC     -> peer-to-peer microphone audio
// Web Audio  -> gain + spatial positioning
//
// Mesh model:
// One remote user = one RTCPeerConnection
//
// users[userId]
//   ├── peerConnection
//   ├── audio
//   ├── position
//   └── pendingIceCandidates
     //& avatar
//
// ============================================================


// ============================================================
// 1. CONFIGURATION
// ============================================================

// ROOM_ID is now supplied at runtime by the join screen (ui.js).

let iceServers = [
    {
        urls: "stun:stun.l.google.com:19302"
    }
];


// ============================================================
// 2. SHARED APPLICATION STATE
// ============================================================

// Socket.IO handles signaling only.
// Audio does not travel through this socket.
const socket = io();
window.socket = socket;

// Define local user state structure
window.localUser = {
    id: "local",
    username: null,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    avatar: null
};

// One AudioContext represents the shared audio world.
// Each remote user gets a separate branch inside this context.
const audioContext = new AudioContext();

export function updateAudioListener(position) {
    if (audioContext && audioContext.listener) {
        const listener = audioContext.listener;
        // Check for modern AudioListener.positionX AudioParam support
        if (listener.positionX) {
            listener.positionX.value = position.x;
            listener.positionY.value = position.y;
            listener.positionZ.value = position.z;
        } else {
            // Fallback for older browsers
            listener.setPosition(position.x, position.y, position.z);
        }
    }
}
window.updateAudioListener = updateAudioListener;

// Local microphone stream.
// The same tracks are attached to each peer connection.
// Exposed on window so ui.js can toggle mute without an import.
let localStream = null;
window.localStream = null;
let activeRoom = null;
let shouldRejoin = false;
// Start with the reliable full-volume path; users can enable the 3D stage once
// their audio device is verified.
let spatialAudioEnabled = false;

// Central store for all remote users.
const users = {};
window.users = users; // expose remote users for reference/debugging


// ============================================================
// 3. USER MANAGEMENT
// ============================================================

// Creates one remote-user state object.
function createUser(userId) {
    return {
        id: userId,

        // Human-readable display name.
        username: null,

        peerConnection: createPeerConnection(userId),

        audio: null,

        position: {
            x: 0,
            y: 0,
            z: 0
        },

        rotation: {
            x: 0,
            y: 0,
            z: 0
        },

        avatar: null,

        pendingIceCandidates: []
    };
}


// Returns an existing user or creates one.
function ensureUser(userId, username = null, position = null) {

    if (!users[userId]) {
        users[userId] = createUser(userId);
        users[userId].avatar = createAvatar(userId);
    }

    if (username) {
        users[userId].username = username;
    }

    if (position) {
        users[userId].position = position;
        users[userId].targetPosition = position;
        updateAvatarPosition(userId, position);
    }

    return users[userId];
}


// Removes all resources owned by one remote user.
function removeUser(userId) {
    const user = users[userId];

    if (!user) return;

    // Disconnect this user's audio branch.
    if (user.audio) {
        user.audio.source?.disconnect();
        user.audio.gainNode?.disconnect();
        user.audio.panner?.disconnect();
        user.audio.element?.pause();
        user.audio.element?.remove();
    }

    // End the WebRTC connection.
    user.peerConnection?.close();

    // Clean up Three.js avatar mesh
    removeAvatar(userId);

    delete users[userId];

    console.log("User removed:", userId);
}

// ============================================================
// 4. WEB AUDIO PIPELINE
// ============================================================
//
// Remote stream
//      ↓
// MediaStreamAudioSourceNode
//      ↓
// GainNode
//      ↓
// PannerNode
//      ↓
// Speakers
//
// ============================================================

function createSpatialAudio(stream, position = null) {
    const source =
        audioContext.createMediaStreamSource(stream);

    const gainNode =
        audioContext.createGain();

    const panner =
        audioContext.createPanner();

    // Native media playback is used as the non-spatial baseline. It avoids
    // browser-specific Web Audio output behavior while retaining the exact
    // remote WebRTC stream.
    const element = document.createElement("audio");
    element.autoplay = true;
    element.playsInline = true;
    element.srcObject = stream;
    element.hidden = true;
    document.body.appendChild(element);


    // Default volume.
    gainNode.gain.value = 1;


    // HRTF provides more realistic directional audio.
    panner.panningModel = "HRTF";

    // Distance behavior for future 3D movement.
    panner.distanceModel = "inverse";
    panner.refDistance = 1;
    panner.maxDistance = 100;
    panner.rolloffFactor = 1;


    // Initial position.
    if (position) {
        if (panner.positionX) {
            panner.positionX.value = position.x;
            panner.positionY.value = position.y;
            panner.positionZ.value = position.z;
        } else {
            panner.setPosition(position.x, position.y, position.z);
        }
    } else {
        panner.positionX.value = 0;
        panner.positionY.value = 0;
        panner.positionZ.value = -5;
    }


    // Build this user's audio branch.
    source.connect(gainNode);
    applyAudioOutput({ gainNode, panner, element });


    return {
        source,
        gainNode,
        panner,
        element
    };
}

function applyAudioOutput(audio) {
    audio.gainNode.disconnect();
    audio.panner.disconnect();
    if (spatialAudioEnabled) {
        audio.element?.pause();
        audio.gainNode.connect(audio.panner);
        audio.panner.connect(audioContext.destination);
    } else {
        audio.element?.play().catch((error) => {
            console.error("Native remote audio playback failed:", error);
            window.uiSetStatus?.("Browser blocked remote audio playback. Click Spatial Audio once, then turn it off.", "error");
        });
    }
}

window.setSpatialAudio = function (enabled) {
    spatialAudioEnabled = enabled;
    for (const user of Object.values(users)) {
        if (user.audio) applyAudioOutput(user.audio);
    }
};


// ============================================================
// 5. PEER CONNECTION FACTORY
// ============================================================
//
// Creates one RTCPeerConnection for one remote user.
//
// Example:
//
// users["alice"].peerConnection
// users["bob"].peerConnection
//
// ============================================================

function createPeerConnection(userId) {
    const pc = new RTCPeerConnection({
        iceServers
    });


    // --------------------------------------------------------
    // SEND ICE CANDIDATES
    // --------------------------------------------------------
    //
    // A candidate generated by this connection belongs only
    // to this specific remote user.
    //
    pc.onicecandidate = (event) => {
        if (!event.candidate) return;

        socket.emit("ice-candidate", {
            targetId: userId,
            candidate: event.candidate
        });

        console.log(
            "ICE candidate sent to:",
            userId
        );
    };


    // --------------------------------------------------------
    // RECEIVE REMOTE AUDIO
    // --------------------------------------------------------
    //
    // A track arriving here belongs to userId because this
    // PeerConnection was created specifically for that user.
    //
    pc.ontrack = async (event) => {
        console.log(
            "Remote track received from:",
            userId
        );

        // Prefer the stream supplied by WebRTC.
        // Fallback creates one from the individual track.
        const remoteStream =
            event.streams[0] ||
            new MediaStream([event.track]);

        event.track.onunmute = () => window.uiSetStatus?.("Receiving voice", "connected");
        event.track.onmute = () => window.uiSetStatus?.("Remote microphone is muted", "error");
        event.track.onended = () => window.uiSetStatus?.("Remote microphone stopped", "error");


        // Browsers may suspend AudioContext until interaction.
        if (audioContext.state === "suspended") {
            try {
                await audioContext.resume();
            } catch (error) {
                console.warn(
                    "AudioContext could not resume:",
                    error
                );
            }
        }


        const user = users[userId];

        if (!user) {
            console.warn(
                "Track received for unknown user:",
                userId
            );
            return;
        }


        // Avoid leaving an old audio graph connected.
        if (user.audio) {
            user.audio.source?.disconnect();
            user.audio.gainNode?.disconnect();
            user.audio.panner?.disconnect();
            user.audio.element?.pause();
            user.audio.element?.remove();
        }


        user.audio =
            createSpatialAudio(remoteStream, user.position);

        window.uiSetStatus?.("Voice connected", "connected");


        console.log(
            "Spatial audio attached to:",
            userId
        );
    };


    // --------------------------------------------------------
    // CONNECTION DEBUGGING
    // --------------------------------------------------------

    pc.oniceconnectionstatechange = () => {
        console.log(
            `ICE State [${userId}]:`,
            pc.iceConnectionState
        );
    };


    pc.onconnectionstatechange = () => {
        console.log(
            `Connection State [${userId}]:`,
            pc.connectionState
        );
        if (pc.connectionState === "failed") {
            window.uiSetStatus?.("Voice connection failed. Check TURN/HTTPS configuration.", "error");
        }
    };


    pc.onsignalingstatechange = () => {
        console.log(
            `Signaling State [${userId}]:`,
            pc.signalingState
        );
    };


    console.log(
        "PeerConnection created for:",
        userId
    );

    return pc;
}


// ============================================================
// 6. LOCAL MICROPHONE
// ============================================================

// Requests microphone access once.
// The same local tracks are reused across peer connections.
async function initializeMedia() {
    localStream =
        await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

    // Keep window reference in sync for ui.js mute control.
    window.localStream = localStream;

    console.log(
        "Local microphone ready"
    );
}


// Attaches our microphone tracks to one peer connection.
function addLocalTracks(pc) {

    if (pc.getSenders().length > 0) {
        return;
    }

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });
}

// ============================================================
// 7. ICE QUEUE MANAGEMENT
// ============================================================

// Adds queued ICE candidates after remote SDP becomes available.
async function flushPendingIceCandidates(userId) {
    const user = users[userId];

    if (!user) return;

    const pc = user.peerConnection;

    while (user.pendingIceCandidates.length > 0) {
        const candidate =
            user.pendingIceCandidates.shift();

        await pc.addIceCandidate(candidate);
    }
}


// ============================================================
// 8. APPLICATION STARTUP
// ============================================================
//
// Order matters:
//
// 1. Get microphone
// 2. Join signaling room
// 3. Begin WebRTC negotiation
//
// ============================================================

// Called by ui.js join button — never runs automatically.
async function start(roomId, username) {
    // Resume during the join click. Waiting for a remote track is too late for
    // autoplay-restricted browsers, which would otherwise keep every voice silent.
    if (audioContext.state === "suspended") {
        await audioContext.resume();
    }
    const response = await fetch("/config");
    if (!response.ok) throw new Error("Could not load connection configuration.");
    const config = await response.json();
    if (Array.isArray(config.iceServers) && config.iceServers.length) iceServers = config.iceServers;
    if (!socket.connected) {
        socket.connect();
        await new Promise((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
        });
    }
    initWorld();
    await initializeMedia();
    await new Promise((resolve, reject) => socket.emit("join-room", { roomId, username }, (result) => {
        result?.ok ? resolve() : reject(new Error(result?.error || "Could not join room."));
    }));
    activeRoom = { roomId, username };
    shouldRejoin = true;

    console.log(
        "Joined room:",
        roomId
    );
}

// Exposed so ui.js can call it.
window.startApp = start;


// ============================================================
// 8b. LEAVE ROOM
// ============================================================

// Closes all peer connections and stops the microphone.
window.leaveRoom = function () {
    shouldRejoin = false;
    activeRoom = null;
    for (const userId of Object.keys(users)) {
        removeUser(userId);
    }
    removeAvatar("local");
    window.localUser.avatar = null;

    if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream       = null;
        window.localStream = null;
    }
    socket.disconnect();

    console.log("Left room.");
};

socket.on("connect", () => window.uiSetStatus?.("Connected", "connected"));
socket.on("disconnect", () => {
    for (const userId of Object.keys(users)) {
        removeUser(userId);
        window.uiRemovePeer?.(userId);
    }
    if (shouldRejoin) window.uiSetStatus?.("Reconnecting…", "");
});
socket.on("connect", () => {
    if (!shouldRejoin || !activeRoom) return;
    socket.emit("join-room", activeRoom, (result) => {
        if (!result?.ok) window.uiSetStatus?.("Could not restore the room connection.", "error");
    });
});


// ============================================================
// 9. PEER JOINED -> CREATE OFFER
// ============================================================
//
// Existing users receive this event when a new user joins.
//
// Example:
// Bob joins.
// Alice creates a dedicated connection to Bob and sends Bob
// an SDP offer.
//
// ============================================================
// Handle local player spawning
socket.on("spawn", ({ position }) => {
    console.log("Local player spawned at:", position);
    if (window.localUser) {
        window.localUser.position = position;
        // Create local avatar mesh
        window.localUser.avatar = createAvatar("local");
        // Update its position
        updateAvatarPosition("local", position);
    }
});


// Handle remote player position/rotation updates
socket.on("position-update", ({ peerId, position, rotation }) => {
    const user = users[peerId];
    if (user) {
        user.targetPosition = position;
        user.targetRotation = rotation;
    }
});


socket.on(
    "existing-peers",

    async (existingPeers) => {

        console.log(
            "Existing peers:",
            existingPeers
        );

        for (const { peerId, username, position } of existingPeers) {

            // Store existing participants.
            // Existing users will initiate offers to us.
            ensureUser(peerId, username, position);

            // Show immediately in the participants list.
            window.uiAddPeer?.(peerId, username);
        }
    }
);
socket.on(
    "peer-joined",

    async ({ peerId, username, position }) => {
        try {

            console.log(
                `${username} joined (${peerId})`
            );

            const user = ensureUser(peerId, username, position);

            window.uiAddPeer?.(peerId, username);

            const pc = user.peerConnection;

            addLocalTracks(pc);

            const offer = await pc.createOffer();

            await pc.setLocalDescription(offer);

            socket.emit("offer", {
                targetId: peerId,
                offer: pc.localDescription
            });

        } catch (error) {
            console.error(error);
        }
    }
);

// ============================================================
// 10. RECEIVE OFFER -> CREATE ANSWER
// ============================================================
//
// The receiver:
//
// 1. Identifies the sender
// 2. Creates sender-specific user state
// 3. Adds local microphone
// 4. Stores remote offer
// 5. Creates answer
// 6. Sends answer back to sender
//
// ============================================================

socket.on(
    "offer",

    async ({ senderId, username, offer }) => {
        try {
            console.log(
                `Offer received from ${username} (${senderId})`
            );


            const user =
                ensureUser(senderId, username);

            const pc =
                user.peerConnection;


            // Our microphone must also travel back
            // through this dedicated connection.
            addLocalTracks(pc);


            await pc.setRemoteDescription(offer);


            // Remote SDP now exists, so queued ICE is safe.
            await flushPendingIceCandidates(senderId);


            const answer =
                await pc.createAnswer();

            await pc.setLocalDescription(answer);


            socket.emit("answer", {
                targetId: senderId,
                answer: pc.localDescription
            });


            console.log(
                "Answer sent to:",
                senderId
            );
        } catch (error) {
            console.error(
                `Offer handling failed for ${senderId}:`,
                error
            );
        }
    }
);


// ============================================================
// 11. RECEIVE ANSWER
// ============================================================
//
// We previously sent an offer.
// The answer completes SDP negotiation for that user's
// dedicated PeerConnection.
//
// ============================================================

socket.on(
    "answer",

    async ({ senderId, username, answer }) => {
        try {
            // ensureUser is safe here: the peer already exists
            // because we sent them an offer in peer-joined.
            const user = users[senderId];

            if (!user) {
                console.warn(
                    "Answer received for unknown user:",
                    senderId
                );
                return;
            }

            // Update username in case it wasn't set yet.
            if (username) user.username = username;

            const pc = user.peerConnection;

            await pc.setRemoteDescription(answer);

            // Apply ICE candidates that arrived early.
            await flushPendingIceCandidates(senderId);

            console.log(
                `Negotiation complete with ${username} (${senderId})`
            );
        } catch (error) {
            console.error(
                `Answer handling failed for ${senderId}:`,
                error
            );
        }
    }
);


// ============================================================
// 12. RECEIVE ICE CANDIDATE
// ============================================================
//
// senderId tells us exactly which PeerConnection owns
// this candidate.
//
// ============================================================

socket.on(
    "ice-candidate",

    async ({ senderId, candidate }) => {
        try {
            // Signaling may deliver ICE before another event
            // has created this user's local state.
            const user =
                ensureUser(senderId);

            const pc =
                user.peerConnection;


            // ICE cannot always be applied before remote SDP.
            if (!pc.remoteDescription) {
                user.pendingIceCandidates.push(candidate);

                console.log(
                    "ICE candidate queued for:",
                    senderId
                );

                return;
            }


            await pc.addIceCandidate(candidate);


            console.log(
                "ICE candidate added for:",
                senderId
            );
        } catch (error) {
            console.error(
                `ICE handling failed for ${senderId}:`,
                error
            );
        }
    }
);


// ============================================================
// 13. USER LEFT
// ============================================================
//
// Remove the departed user's:
//
// - audio graph
// - WebRTC connection
// - local state
//
// ============================================================

socket.on(
    "user-left",

    ({ peerId }) => {
        removeUser(peerId);
        window.uiRemovePeer?.(peerId);
    }
);

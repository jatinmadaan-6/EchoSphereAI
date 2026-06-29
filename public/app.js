// Connect to the signaling server
const socket = io();

// Create the RTCPeerConnection
const peerConnection = new RTCPeerConnection({
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
});

const ROOM_ID = "test-room";

// Join the room
socket.emit("join-room", ROOM_ID);

// Initialize microphone and PeerConnection
async function initializeMedia() {

    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
    });

    console.log("Local Stream:", stream);

    // Add every track to the PeerConnection
    stream.getTracks().forEach(track => {
        console.log("Adding Track:", track);
        peerConnection.addTrack(track, stream);
    });

    console.log("All tracks added!");

}

initializeMedia();


// ==============================
// OFFER FLOW
// ==============================

// Someone joined after us
socket.on("peer-joined", async (peerId) => {

    console.log("Peer joined:", peerId);

    // Create Offer
    const offer = await peerConnection.createOffer();

    console.log("Offer Created");
    console.log(offer);

    // Save locally
    await peerConnection.setLocalDescription(offer);

    console.log("Local Description Set");

    // Send to the other browser
    socket.emit("offer", {
        roomId: ROOM_ID,
        offer: offer
    });

});


// ==============================
// RECEIVE OFFER
// ==============================

socket.on("offer", async (offer) => {

    console.log("Offer Received");

    // Store Browser A's Offer
    await peerConnection.setRemoteDescription(offer);

    console.log("Remote Description Set");

    // Create Answer
    const answer = await peerConnection.createAnswer();

    console.log("Answer Created");

    // Store Browser B's Answer
    await peerConnection.setLocalDescription(answer);

    console.log("Local Description Set");

    // Send Answer Back
    socket.emit("answer", {
        roomId: ROOM_ID,
        answer: answer
    });

});


// ==============================
// RECEIVE ANSWER
// ==============================

socket.on("answer", async (answer) => {

    console.log("Answer Received");

    // Store Browser B's Answer
    await peerConnection.setRemoteDescription(answer);

    console.log("Negotiation Complete!");

    console.log("Signaling State:", peerConnection.signalingState);

});
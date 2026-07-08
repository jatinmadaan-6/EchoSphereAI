// ============================================================
// ECHOSPHERE CLIENT
//
// Architecture:
//
// Socket.io
//      |
//      |  (Signaling only)
//      |
// WebRTC RTCPeerConnection
//      |
//      |  (P2P Audio)
//      |
// Web Audio API
//      |
// GainNode + PannerNode
//      |
// Spatial Sound
//
// ============================================================





// ============================================================
// 1. SIGNALING CONNECTION
// ============================================================
//
// Problem:
// Two browsers do not know each other initially.
//
// Solution:
// Use Socket.io as a meeting point.
//
// IMPORTANT:
// Socket.io does NOT carry audio.
// It only exchanges:
// - SDP offers/answers
// - ICE candidates
//
// After connection, audio bypasses this server.
// ============================================================


const socket = io();

const ROOM_ID = "test-room";





// ============================================================
// 2. WEB AUDIO ENGINE
// ============================================================
//
// Problem:
// WebRTC gives us audio,
// but it does not know anything about:
//
// - volume
// - direction
// - distance
//
// Web Audio API lets us manipulate sound.
//
// This is where EchoSphere is built.
//
// ============================================================


const audioContext = new AudioContext();





// ============================================================
// 3. CREATE WEBRTC CONNECTION
// ============================================================
//
// Problem:
// Browsers need a manager to handle:
//
// - SDP negotiation
// - ICE candidates
// - encryption
// - media transport
//
// RTCPeerConnection is that manager.
//
// ============================================================


const peerConnection = new RTCPeerConnection({

    iceServers: [

        {
            // STUN helps discover public-facing address
            // for NAT traversal.

            urls:
            "stun:stun.l.google.com:19302"
        }

    ]

});





// ============================================================
// 4. MICROPHONE INITIALIZATION
// ============================================================
//
// Problem:
// Browser cannot access microphone directly.
//
// getUserMedia asks permission and gives:
//
// MediaStream
//      |
//      └── AudioTrack
//
// We attach this track to WebRTC.
// ============================================================


async function initializeMedia(){


    const localStream =
        await navigator.mediaDevices.getUserMedia({

            audio:true

        });



    console.log(
        "Local stream obtained",
        localStream
    );



    localStream.getTracks()
    .forEach(track=>{


        console.log(
            "Adding local track",
            track
        );


        // Tell WebRTC:
        // "Send this microphone track
        //  to the other peer."

        peerConnection.addTrack(

            track,

            localStream

        );


    });


}





// ============================================================
// 5. START APPLICATION
// ============================================================
//
// Order matters.
//
// Wrong:
//
// Join room
// Create offer
// Get microphone
//
// The SDP would not know we have audio.
//
// Correct:
//
// Get microphone
// Add tracks
// Join room
//
// ============================================================


async function start(){


    await initializeMedia();


    socket.emit(
        "join-room",
        ROOM_ID
    );


    console.log(
        "Joined room"
    );


}


start();







// ============================================================
// 6. ICE CANDIDATE EXCHANGE
// ============================================================
//
// Problem:
// Even after knowing each other's capabilities,
// peers don't know where to connect.
//
// ICE finds possible network paths.
//
// Candidate examples:
//
// Local IP
// Public IP from STUN
// TURN relay
//
// Candidates travel through Socket.io.
//
// ============================================================



peerConnection.onicecandidate = (event)=>{


    if(event.candidate){


        socket.emit(
            "ice-candidate",
            {

                roomId:ROOM_ID,

                candidate:event.candidate

            }
        );


    }


};





socket.on(
"ice-candidate",

async(candidate)=>{


    await peerConnection.addIceCandidate(
        candidate
    );


    console.log(
        "ICE candidate added"
    );


});









// ============================================================
// 7. CONNECTION DEBUGGING
// ============================================================


peerConnection.onconnectionstatechange = ()=>{


    console.log(
        "Connection:",
        peerConnection.connectionState
    );


};


peerConnection.oniceconnectionstatechange = ()=>{


    console.log(
        "ICE:",
        peerConnection.iceConnectionState
    );


};









// ============================================================
// 8. CREATE OFFER
// ============================================================
//
// Problem:
// One peer needs to start negotiation.
//
// Offer says:
//
// "Here are my media capabilities."
//
// ============================================================


socket.on(
"peer-joined",

async()=>{


    const offer =
        await peerConnection.createOffer();



    await peerConnection.setLocalDescription(
        offer
    );



    socket.emit(
        "offer",
        {

            roomId:ROOM_ID,

            offer

        }
    );


});









// ============================================================
// 9. RECEIVE OFFER AND CREATE ANSWER
// ============================================================
//
// Receiver:
//
// 1. Stores remote capabilities
// 2. Creates compatible answer
//
// ============================================================


socket.on(
"offer",

async(offer)=>{


    await peerConnection.setRemoteDescription(
        offer
    );



    const answer =
        await peerConnection.createAnswer();



    await peerConnection.setLocalDescription(
        answer
    );



    socket.emit(
        "answer",
        {

            roomId:ROOM_ID,

            answer

        }
    );


});









// ============================================================
// 10. RECEIVE ANSWER
// ============================================================
//
// Now both peers know:
//
// "How to communicate"
//
// SDP negotiation complete.
//
// ============================================================


socket.on(
"answer",

async(answer)=>{


    await peerConnection.setRemoteDescription(
        answer
    );


    console.log(
        "Negotiation complete"
    );


});









// ============================================================
// 11. SPATIAL AUDIO PIPELINE
// ============================================================
//
// This is EchoSphere.
//
// WebRTC gives:
//
// Remote Audio Stream
//
// We convert it into:
//
// Web Audio nodes
//
// Flow:
//
// Remote Stream
//       |
//       ↓
// Source Node
//       |
//       ↓
// GainNode
//       |
//       ↓
// PannerNode
//       |
//       ↓
// Speakers
//
// ============================================================



peerConnection.ontrack = async(event)=>{


    console.log(
        "Remote audio received"
    );



    const remoteStream =
        new MediaStream();



    remoteStream.addTrack(
        event.track
    );




    // Browser may suspend audio
    // until user interaction.

    if(audioContext.state==="suspended"){

        await audioContext.resume();

    }




    // Convert WebRTC stream
    // into Web Audio world.

    const source =
        audioContext.createMediaStreamSource(
            remoteStream
        );






    // ========================================================
    // GAIN NODE
    //
    // Controls volume.
    //
    // Later:
    // distance calculation
    // will control this value.
    //
    // Far person = low gain
    // Near person = high gain
    // ========================================================


    const gainNode =
        audioContext.createGain();



    gainNode.gain.value = 1;






    // ========================================================
    // PANNER NODE
    //
    // Places sound in 3D space.
    //
    // x = left/right
    // y = up/down
    // z = front/back
    //
    // HRTF simulates human hearing.
    // ========================================================


    const panner =
        audioContext.createPanner();



    panner.panningModel = "HRTF";



    // Temporary hardcoded position.
    //
    // Later this will come from:
    // Three.js player position.

    panner.positionX.value = -5;

    panner.positionY.value = 0;

    panner.positionZ.value = 0;






    // Final audio graph:
    //
    // Remote Voice
    //      |
    //      ↓
    // Source
    //      |
    //      ↓
    // Gain
    //      |
    //      ↓
    // Panner
    //      |
    //      ↓
    // Speaker


    source.connect(
        gainNode
    );


    gainNode.connect(
        panner
    );


    panner.connect(
        audioContext.destination
    );



    console.log(
        "Spatial audio pipeline created"
    );


};
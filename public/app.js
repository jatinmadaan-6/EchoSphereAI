// ============================================================
// SOCKET.IO CONNECTION
// ============================================================
// Socket.io is NOT carrying audio.
// It only helps peers exchange:
// 1. SDP (offer/answer)
// 2. ICE candidates
//
// After WebRTC connects, audio goes peer-to-peer.
// ============================================================

const socket = io();

const ROOM_ID = "test-room";



// ============================================================
// WEB AUDIO API SETUP
// ============================================================
// AudioContext is our audio processing engine.
//
// Currently:
// Remote Audio → AudioContext → Speakers
//
// Later:
// Remote Audio → GainNode → PannerNode → Speakers
//
// This is what will make EchoSphere spatial.
// ============================================================

const audioContext = new AudioContext();




// ============================================================
// RTCPeerConnection SETUP
// ============================================================
// This object manages the WebRTC connection.
//
// It handles:
// - SDP negotiation
// - ICE candidates
// - Media transport
// - Connection state
//
// STUN server helps discover our public-facing address.
// ============================================================


const peerConnection = new RTCPeerConnection({

    iceServers: [

        {
            urls: "stun:stun.l.google.com:19302"
        }

    ]

});





// ============================================================
// GET MICROPHONE + ADD TRACKS
// ============================================================
// Problem:
// WebRTC cannot magically access your microphone.
//
// getUserMedia() asks the browser for permission.
//
// The MediaStream contains tracks.
//
// Example:
//
// MediaStream
//      |
//      └── AudioTrack
//
// We attach these tracks to RTCPeerConnection.
// ============================================================


async function initializeMedia(){


    const localStream =
        await navigator.mediaDevices.getUserMedia({

            audio:true

        });



    console.log(
        "Local Stream:",
        localStream
    );



    localStream.getTracks()
    .forEach(track=>{


        console.log(
            "Adding Track:",
            track
        );


        peerConnection.addTrack(

            track,

            localStream

        );


    });



    console.log(
        "All tracks added"
    );


}




// ============================================================
// START APPLICATION
// ============================================================
// Important order:
//
// 1. Get microphone
// 2. Add tracks
// 3. Join room
//
// Why?
//
// Because SDP must know what media we support.
// If we create an offer before adding tracks,
// the offer may contain no audio.
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
// ICE CANDIDATE HANDLING
// ============================================================
// ICE finds possible network paths.
//
// Example candidates:
//
// Local IP
// Public IP discovered through STUN
// Relay through TURN
//
// These candidates must be exchanged through
// our signaling server.
//
// ============================================================



peerConnection.onicecandidate = (event)=>{


    if(event.candidate){


        console.log(
            "Sending ICE candidate"
        );



        socket.emit(
            "ice-candidate",
            {

                roomId: ROOM_ID,

                candidate:event.candidate

            }

        );


    }


};





// Receive ICE candidates from the other peer


socket.on(
"ice-candidate",

async(candidate)=>{


    try{


        await peerConnection.addIceCandidate(
            candidate
        );


        console.log(
            "ICE candidate added"
        );


    }

    catch(error){


        console.error(
            "ICE error:",
            error
        );


    }


});









// ============================================================
// CONNECTION DEBUGGING
// ============================================================


peerConnection.oniceconnectionstatechange = ()=>{


    console.log(

        "ICE State:",
        peerConnection.iceConnectionState

    );


};




peerConnection.onconnectionstatechange = ()=>{


    console.log(

        "Connection State:",
        peerConnection.connectionState

    );


};




peerConnection.onsignalingstatechange = ()=>{


    console.log(

        "Signaling State:",
        peerConnection.signalingState

    );


};









// ============================================================
// OFFER CREATION
// ============================================================
// When a new peer joins:
//
// Existing user creates OFFER.
//
// Offer contains:
//
// - Supported codecs
// - Media capabilities
// - Transport information
//
// Then it is sent through Socket.io.
//
// ============================================================


socket.on(
"peer-joined",

async(peerId)=>{


    console.log(
        "Peer joined:",
        peerId
    );



    const offer =
        await peerConnection.createOffer();



    console.log(
        "Offer created"
    );



    await peerConnection.setLocalDescription(
        offer
    );


    console.log(
        "Local Description Set"
    );



    socket.emit(
        "offer",
        {

            roomId:ROOM_ID,

            offer:offer

        }

    );


});









// ============================================================
// RECEIVE OFFER
// ============================================================
// Other peer receives offer.
//
// It stores it as remote description.
//
// Then creates an answer.
//
// ============================================================



socket.on(
"offer",

async(offer)=>{


    console.log(
        "Offer Received"
    );



    await peerConnection.setRemoteDescription(
        offer
    );



    console.log(
        "Remote Description Set"
    );



    const answer =
        await peerConnection.createAnswer();



    console.log(
        "Answer Created"
    );



    await peerConnection.setLocalDescription(
        answer
    );



    console.log(
        "Local Description Set"
    );



    socket.emit(
        "answer",
        {

            roomId:ROOM_ID,

            answer:answer

        }

    );


});









// ============================================================
// RECEIVE ANSWER
// ============================================================
// Original sender receives answer.
//
// Now both peers know:
//
// "We agree on how we communicate."
//
// SDP negotiation is complete.
// ============================================================



socket.on(
"answer",

async(answer)=>{


    console.log(
        "Answer Received"
    );



    await peerConnection.setRemoteDescription(
        answer
    );



    console.log(
        "Negotiation Complete"
    );


});









// ============================================================
// RECEIVE REMOTE AUDIO
// ============================================================
// This is where WebRTC connects with Web Audio.
//
// Before:
//
// Remote Stream → <audio> → Speaker
//
//
// Now:
//
// Remote Stream
//       |
//       ↓
// MediaStreamAudioSourceNode
//       |
//       ↓
// AudioContext
//       |
//       ↓
// Speakers
//
// Later:
//
// AudioContext
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
        "Remote Track Received"
    );



    // Create a MediaStream
    // and put the incoming track inside it

    const remoteStream =
        new MediaStream();



    remoteStream.addTrack(
        event.track
    );



    // Browsers sometimes suspend AudioContext
    // until user interaction

    if(audioContext.state==="suspended"){

        await audioContext.resume();

    }




    // Convert WebRTC MediaStream
    // into Web Audio node

    const source =
        audioContext.createMediaStreamSource(
            remoteStream
        );




    // Connect audio to speakers

    source.connect(
        audioContext.destination
    );



    console.log(
        "Remote audio connected through Web Audio"
    );


};
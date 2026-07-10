// ============================================================
// ECHOSPHERE AI — SIGNALING SERVER
// ============================================================
//
// Responsibilities:
//
// 1. Serve frontend files
// 2. Manage Socket.IO rooms
// 3. Route SDP offers
// 4. Route SDP answers
// 5. Route ICE candidates
// 6. Notify peers when a user leaves
//
// Important:
//
// This server does NOT carry microphone audio.
//
// Audio flows directly between browsers through WebRTC
// in the current mesh architecture.
//
// ============================================================


// ============================================================
// 1. DEPENDENCIES
// ============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");


// ============================================================
// 2. SERVER SETUP
// ============================================================

const app = express();

const server =
    http.createServer(app);

const io =
    new Server(server);

const PORT =
    process.env.PORT || 3000;


// Serve index.html, app.js, and other frontend assets.
app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ============================================================
// 3. SOCKET CONNECTION
// ============================================================

io.on(
    "connection",

    (socket) => {
        console.log(
            "User connected:",
            socket.id
        );


        // ----------------------------------------------------
        // JOIN ROOM
        // ----------------------------------------------------
        //
        // Existing peers are notified about the newcomer.
        // They can then create targeted WebRTC offers.
        //
        socket.on(
            "join-room",

            (roomId) => {
                socket.join(roomId);


                // Remember room membership for cleanup.
                socket.data.roomId = roomId;


                console.log(
                    `${socket.id} joined ${roomId}`
                );


                // Notify existing users only.
                socket
                    .to(roomId)
                    .emit(
                        "peer-joined",
                        socket.id
                    );
            }
        );


        // ----------------------------------------------------
        // ROUTE OFFER
        // ----------------------------------------------------
        //
        // The server does not inspect SDP.
        // It forwards the offer to one target socket.
        //
        socket.on(
            "offer",

            ({ targetId, offer }) => {
                io
                    .to(targetId)
                    .emit(
                        "offer",
                        {
                            senderId: socket.id,
                            offer
                        }
                    );


                console.log(
                    `Offer: ${socket.id} -> ${targetId}`
                );
            }
        );


        // ----------------------------------------------------
        // ROUTE ANSWER
        // ----------------------------------------------------
        //
        // Send the SDP answer back to the original offerer.
        //
        socket.on(
            "answer",

            ({ targetId, answer }) => {
                io
                    .to(targetId)
                    .emit(
                        "answer",
                        {
                            senderId: socket.id,
                            answer
                        }
                    );


                console.log(
                    `Answer: ${socket.id} -> ${targetId}`
                );
            }
        );


        // ----------------------------------------------------
        // ROUTE ICE CANDIDATE
        // ----------------------------------------------------
        //
        // Each candidate belongs to one specific
        // peer-to-peer connection.
        //
        socket.on(
            "ice-candidate",

            ({ targetId, candidate }) => {
                io
                    .to(targetId)
                    .emit(
                        "ice-candidate",
                        {
                            senderId: socket.id,
                            candidate
                        }
                    );
            }
        );


        // ----------------------------------------------------
        // DISCONNECT CLEANUP
        // ----------------------------------------------------
        //
        // Tell remaining room members to remove this user's
        // connection and audio pipeline.
        //
        socket.on(
            "disconnect",

            () => {
                const roomId =
                    socket.data.roomId;


                if (roomId) {
                    socket
                        .to(roomId)
                        .emit(
                            "user-left",
                            socket.id
                        );
                }


                console.log(
                    "User disconnected:",
                    socket.id
                );
            }
        );
    }
);


// ============================================================
// 4. START SERVER
// ============================================================

server.listen(
    PORT,

    () => {
        console.log(
            `EchoSphere running on http://localhost:${PORT}`
        );
    }
);
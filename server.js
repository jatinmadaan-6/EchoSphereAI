const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {

    console.log(`User Connected: ${socket.id}`);

    // -----------------------------
    // Join Room
    // -----------------------------
    socket.on("join-room", (roomId) => {

        socket.join(roomId);

        console.log(`${socket.id} joined room: ${roomId}`);

        // Notify everyone except the sender
        socket.to(roomId).emit("peer-joined", socket.id);

    });

    // -----------------------------
    // Forward Offer
    // -----------------------------
    socket.on("offer", ({ roomId, offer }) => {

        console.log(`Offer received from ${socket.id}`);

        socket.to(roomId).emit("offer", offer);

    });

    // -----------------------------
    // Forward Answer
    // -----------------------------
    socket.on("answer", ({ roomId, answer }) => {

        console.log(`Answer received from ${socket.id}`);

        socket.to(roomId).emit("answer", answer);

    });

    // -----------------------------
    // Disconnect
    // -----------------------------
    socket.on("disconnect", () => {

        console.log(`User Disconnected: ${socket.id}`);

    });

    
socket.on("ice-candidate", ({roomId, candidate}) => {

    console.log("ICE candidate received");

    socket.to(roomId).emit(
        "ice-candidate",
        candidate
    );

});


});

server.listen(3000, () => {

    console.log("EchoSphere Signaling Server running on http://localhost:3000");

});
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 3000;
const MAX_NAME_LENGTH = 40;
const MAX_ROOM_LENGTH = 64;
const POSITION_INTERVAL_MS = 75;

function isText(value, maxLength) {
    return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isPosition(value) {
    return value && [value.x, value.y, value.z].every((coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate) && Math.abs(coordinate) <= 30
    );
}

function isDescription(value) {
    return value && typeof value.type === "string" && typeof value.sdp === "string" && value.sdp.length <= 200000;
}

function isCandidate(value) {
    return value && typeof value.candidate === "string" && value.candidate.length <= 10000;
}

function createApp() {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, { maxHttpBufferSize: 250_000 });

    app.disable("x-powered-by");
    app.use(express.static(path.join(__dirname, "public")));
    app.use("/vendor/three", express.static(path.join(__dirname, "node_modules", "three", "build")));
    app.use(express.json({ limit: "10kb" }));

    // TURN credentials should be issued by a trusted service in production.
    app.get("/config", (_req, res) => {
        const iceServers = [{ urls: process.env.STUN_URL || "stun:stun.l.google.com:19302" }];
        if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
            iceServers.push({ urls: process.env.TURN_URL, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
        }
        res.set("Cache-Control", "no-store").json({ iceServers });
    });

    app.post("/log", (req, res) => {
        const body = req.body || {};
        console.error("Client error:", String(body.message || body.reason || "unknown error").slice(0, 1000));
        res.sendStatus(204);
    });

    io.on("connection", (socket) => {
        socket.on("join-room", async (payload, acknowledge = () => {}) => {
            const { roomId, username } = payload || {};
            if (!isText(roomId, MAX_ROOM_LENGTH) || !isText(username, MAX_NAME_LENGTH)) {
                acknowledge({ ok: false, error: "A valid room and username are required." });
                return;
            }

            if (socket.data.roomId) socket.leave(socket.data.roomId);
            const cleanRoomId = roomId.trim();
            socket.join(cleanRoomId);
            socket.data.roomId = cleanRoomId;
            socket.data.username = username.trim();
            socket.data.position = { x: Math.random() * 10 - 5, y: 0, z: Math.random() * 10 - 5 };

            const sockets = await io.in(cleanRoomId).fetchSockets();
            const existingPeers = sockets.filter((peer) => peer.id !== socket.id).map((peer) => ({
                peerId: peer.id, username: peer.data.username, position: peer.data.position
            }));
            socket.emit("existing-peers", existingPeers);
            socket.emit("spawn", { position: socket.data.position });
            socket.to(cleanRoomId).emit("peer-joined", {
                peerId: socket.id, username: socket.data.username, position: socket.data.position
            });
            acknowledge({ ok: true });
        });

        function targetInSameRoom(targetId) {
            const target = io.sockets.sockets.get(targetId);
            return Boolean(socket.data.roomId && target && target.data.roomId === socket.data.roomId);
        }

        socket.on("offer", ({ targetId, offer } = {}) => {
            if (targetInSameRoom(targetId) && isDescription(offer)) {
                io.to(targetId).emit("offer", { senderId: socket.id, username: socket.data.username, offer });
            }
        });
        socket.on("answer", ({ targetId, answer } = {}) => {
            if (targetInSameRoom(targetId) && isDescription(answer)) {
                io.to(targetId).emit("answer", { senderId: socket.id, username: socket.data.username, answer });
            }
        });
        socket.on("ice-candidate", ({ targetId, candidate } = {}) => {
            if (targetInSameRoom(targetId) && isCandidate(candidate)) {
                io.to(targetId).emit("ice-candidate", { senderId: socket.id, candidate });
            }
        });
        socket.on("position-update", ({ x, y, z, rotation } = {}) => {
            const position = { x, y, z };
            if (!socket.data.roomId || !isPosition(position)) return;
            const now = Date.now();
            if (now - (socket.data.lastPositionAt || 0) < POSITION_INTERVAL_MS) return;
            socket.data.lastPositionAt = now;
            socket.data.position = position;
            socket.to(socket.data.roomId).emit("position-update", {
                peerId: socket.id, position, rotation: rotation || { x: 0, y: 0, z: 0 }
            });
        });
        socket.on("disconnect", () => {
            if (socket.data.roomId) socket.to(socket.data.roomId).emit("user-left", { peerId: socket.id });
        });
    });
    return { app, server, io };
}

if (require.main === module) {
    createApp().server.listen(PORT, () => console.log(`EchoSphere running on http://localhost:${PORT}`));
}

module.exports = { createApp, isPosition, isText };

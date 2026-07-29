// ============================================================
// ECHOSPHERE AI — UI CONTROLLER
// ============================================================
//
// Responsibilities:
//
// 1. Join screen validation and submission
// 2. Room screen participant list management
// 3. Mute / unmute toggle
// 4. Leave room
//
// Bridge to app.js:
//
// UI calls        app.js exposes
// ─────────────── ──────────────────
// start()      ←  window.startApp(roomId, username)
// addPeer()    ←  window.uiAddPeer(userId, username)
// removePeer() ←  window.uiRemovePeer(userId)
// setStatus()  ←  window.uiSetStatus(text, state)
//
// ============================================================


// ============================================================
// 1. DOM REFERENCES
// ============================================================

const joinScreen        = document.getElementById("join-screen");
const roomScreen        = document.getElementById("room-screen");
const usernameInput     = document.getElementById("username");
const roomInput         = document.getElementById("room-id");
const joinButton        = document.getElementById("join-btn");
const participantsList  = document.getElementById("participants-list");
const statusText        = document.getElementById("connection-status");
const currentRoomLabel  = document.getElementById("current-room");
const muteButton        = document.getElementById("mute-btn");
const leaveButton       = document.getElementById("leave-btn");


// ============================================================
// 2. LOCAL STATE
// ============================================================

let isMuted       = false;
let localUsername = "";


// ============================================================
// 3. SCREEN HELPERS
// ============================================================

function showJoinScreen() {
    joinScreen.hidden = false;
    roomScreen.hidden = true;
}

function showRoomScreen(roomId) {
    currentRoomLabel.textContent = roomId;
    joinScreen.hidden = true;
    roomScreen.hidden = false;
}


// ============================================================
// 4. PARTICIPANT LIST
// ============================================================

// Adds "You" entry once we join.
function addSelf(username) {
    // Clear any "waiting" placeholder first.
    clearEmptyState();

    const li = document.createElement("li");
    li.id = "participant-self";

    li.innerHTML = `
        <span class="avatar">${initials(username)}</span>
        <span>${escapeHtml(username)}</span>
        <span class="you-badge">you</span>
    `;

    participantsList.appendChild(li);
}

// Called by app.js when a remote peer is confirmed.
window.uiAddPeer = function (userId, username) {
    // Deduplicate — ignore if already rendered.
    if (document.getElementById(`participant-${userId}`)) return;

    clearEmptyState();

    const li = document.createElement("li");
    li.id = `participant-${userId}`;

    li.innerHTML = `
        <span class="avatar">${initials(username)}</span>
        <span>${escapeHtml(username)}</span>
    `;

    participantsList.appendChild(li);
};

// Called by app.js when a peer disconnects.
window.uiRemovePeer = function (userId) {
    const el = document.getElementById(`participant-${userId}`);
    if (el) el.remove();
    maybeShowEmptyState();
};

// Shows a placeholder when the room is empty apart from self.
function maybeShowEmptyState() {
    const peers = participantsList.querySelectorAll(
        "li:not(#participant-self):not(.empty)"
    );
    if (peers.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "No other participants yet…";
        participantsList.appendChild(li);
    }
}

function clearEmptyState() {
    const empty = participantsList.querySelector(".empty");
    if (empty) empty.remove();
}


// ============================================================
// 5. STATUS
// ============================================================

// state: "" | "connected" | "error"
window.uiSetStatus = function (text, state = "") {
    statusText.textContent = text;
    statusText.className   = state;
};


// ============================================================
// 6. JOIN BUTTON
// ============================================================

joinButton.addEventListener("click", handleJoin);

// Also allow pressing Enter in either input field.
[usernameInput, roomInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleJoin();
    });
});

async function handleJoin() {
    const username = usernameInput.value.trim();
    const roomId   = roomInput.value.trim();

    // ---- Validation ----
    let valid = true;

    if (!username) {
        usernameInput.classList.add("error");
        valid = false;
    } else {
        usernameInput.classList.remove("error");
    }

    if (!roomId) {
        roomInput.classList.add("error");
        valid = false;
    } else {
        roomInput.classList.remove("error");
    }

    if (!valid) return;

    // ---- Disable button while connecting ----
    joinButton.disabled    = true;
    joinButton.textContent = "Connecting…";

    try {
        localUsername = username;

        // Hand off to the WebRTC layer in app.js.
        await window.startApp(roomId, username);

        showRoomScreen(roomId);
        addSelf(username);
        maybeShowEmptyState();
        window.uiSetStatus("Connected", "connected");

    } catch (err) {
        console.error("Join failed:", err);
        window.uiSetStatus("Microphone access denied or connection failed.", "error");
        joinButton.disabled    = false;
        joinButton.textContent = "Join Room";
    }
}


// ============================================================
// 7. MUTE BUTTON
// ============================================================

muteButton.addEventListener("click", () => {
    isMuted = !isMuted;

    // Toggle every audio track on the local stream.
    if (window.localStream) {
        window.localStream.getAudioTracks().forEach((track) => {
            track.enabled = !isMuted;
        });
    }

    muteButton.textContent = isMuted ? "Unmute" : "Mute";
    muteButton.classList.toggle("muted", isMuted);
});


// ============================================================
// 8. LEAVE BUTTON
// ============================================================

leaveButton.addEventListener("click", () => {
    // Tell the WebRTC layer to clean up.
    if (typeof window.leaveRoom === "function") {
        window.leaveRoom();
    }

    // Reset UI.
    participantsList.innerHTML = "";
    isMuted = false;
    muteButton.textContent = "Mute";
    muteButton.classList.remove("muted");
    usernameInput.value = localUsername; // preserve last username
    window.uiSetStatus("Connecting...", "");
    showJoinScreen();

    // Re-enable join button.
    joinButton.disabled    = false;
    joinButton.textContent = "Join Room";
});


// ============================================================
// 9. UTILITIES
// ============================================================

function initials(name) {
    return name
        .split(/\s+/)
        .map((w) => w[0] ?? "")
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}


// ============================================================
// 10. INITIAL STATE
// ============================================================

showJoinScreen();
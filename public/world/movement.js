import { updateAvatarPosition } from "./avatar.js";

// Tracks active keys for local player movement
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Keyboard event listeners
window.addEventListener("keydown", (e) => {
    // Avoid moving if user is typing in a text field
    if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
        return;
    }
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = true;
    }
});

window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = false;
    }
});

/**
 * Handles WASD local movement.
 * Updates local avatar mesh position, local user state position, and Web Audio listener.
 */
const speed = 0.08;

export function updateLocalMovement() {
    const localUser = window.localUser;
    if (!localUser || !localUser.position) return;

    let dx = 0;
    let dz = 0;

    if (keys.w) dz -= 1; // Move forward (negative Z)
    if (keys.s) dz += 1; // Move backward (positive Z)
    if (keys.a) dx -= 1; // Move left (negative X)
    if (keys.d) dx += 1; // Move right (positive X)

    // Normalize vector to ensure diagonal movement speed matches orthogonal speed
    if (dx !== 0 && dz !== 0) {
        const length = Math.sqrt(dx * dx + dz * dz);
        dx /= length;
        dz /= length;
    }

    if (dx !== 0 || dz !== 0) {
        localUser.position.x += dx * speed;
        localUser.position.z += dz * speed;

        // Keep local user bound to the 60x60 ground grid (range: -30 to 30)
        localUser.position.x = Math.max(-30, Math.min(30, localUser.position.x));
        localUser.position.z = Math.max(-30, Math.min(30, localUser.position.z));

        // Update local avatar's Three.js position
        updateAvatarPosition("local", localUser.position);

        // Update Web Audio listener position
        if (typeof window.updateAudioListener === "function") {
            window.updateAudioListener(localUser.position);
        }
    }
}

/**
 * Position Synchronization Module
 * Sends local player position and rotation to the server at 10 updates per second.
 */

function sendPosition() {
    const socket = window.socket;
    const localUser = window.localUser;

    // Only send if socket is connected and localUser exists
    if (socket && socket.connected && localUser && localUser.position && localUser.rotation) {
        socket.emit("position-update", {
            x: localUser.position.x,
            y: localUser.position.y,
            z: localUser.position.z,
            rotation: {
                x: localUser.rotation.x,
                y: localUser.rotation.y,
                z: localUser.rotation.z
            }
        });
    }
}

// Set up the interval to send position updates every 100 milliseconds (10 updates/sec)
setInterval(sendPosition, 100);

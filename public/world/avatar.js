import * as THREE from "/vendor/three/three.module.js";
import { getScene } from "./world.js";

// Keep track of all active avatars: userId -> { mesh, userId }
const avatars = {};

/**
 * Creates a new 3D avatar mesh for a user, adds it to the scene,
 * and tracks it in the avatars map.
 * @param {string} userId
 * @returns {object|null} The avatar object containing { mesh, userId }
 */
export function createAvatar(userId) {
    if (avatars[userId]) {
        return avatars[userId];
    }

    const scene = getScene();
    if (!scene) {
        console.warn("Three.js scene is not initialized yet. Cannot create avatar for:", userId);
        return null;
    }

    // Use CapsuleGeometry for a simple character representation
    const radius = 0.4;
    const length = 1.0; // Total height will be length + 2 * radius = 1.8 units
    const geometry = new THREE.CapsuleGeometry(radius, length, 4, 8);

    // Generate a unique-ish color based on the hash of the userId
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = Math.abs(hash) % 0xffffff;

    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.1
    });

    const mesh = new THREE.Mesh(geometry, material);

    const directionMarker =
    new THREE.Mesh(
        new THREE.ConeGeometry(
            0.15,
            0.4,
            16
        ),
        new THREE.MeshStandardMaterial({
            color: 0xff0000
        })
    );


// Point cone forward
directionMarker.rotation.x = Math.PI / 2;


// Place it slightly in front
directionMarker.position.z = -0.6;


mesh.add(directionMarker);
    
    // Position it so the base rests on the ground (y = 0)
    // The center of the capsule is at y = (length / 2) + radius = 0.5 + 0.4 = 0.9
    mesh.position.set(0, 0.9, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);

    const avatar = {
        mesh,
        userId
    };

    avatars[userId] = avatar;
    return avatar;
}

/**
 * Removes a user's avatar mesh from the scene and cleans up its resources.
 * @param {string} userId
 */
export function removeAvatar(userId) {
    const avatar = avatars[userId];
    if (!avatar) return;

    const scene = getScene();
    if (scene) {
        scene.remove(avatar.mesh);
    }

    // Clean up WebGL resources
    if (avatar.mesh.geometry) {
        avatar.mesh.geometry.dispose();
    }
    if (avatar.mesh.material) {
        if (Array.isArray(avatar.mesh.material)) {
            avatar.mesh.material.forEach((mat) => mat.dispose());
        } else {
            avatar.mesh.material.dispose();
        }
    }

    delete avatars[userId];
}

/**
 * Updates an avatar's position in the Three.js scene.
 * @param {string} userId
 * @param {object} position Object with { x, y, z }
 */
export function updateAvatarPosition(userId, position) {
    const avatar = avatars[userId];
    if (!avatar) return;

    if (position && typeof position.x === "number" && typeof position.y === "number" && typeof position.z === "number") {
        avatar.mesh.position.set(position.x, position.y + 0.9, position.z);
    }
}

/**
 * Retrieve all currently tracked avatars.
 * @returns {object} Maps userId -> { mesh, userId }
 */
export function getAvatars() {
    return avatars;
}

/**
 * Iterates through remote users and smoothly interpolates their visual avatar meshes
 * towards their network targetPositions.
 */
export function updateRemoteAvatars() {
    const users = window.users;
    if (!users) return;

    for (const userId in users) {
        const user = users[userId];
        if (user && user.avatar && user.targetPosition) {
            const mesh = user.avatar.mesh;
            
            // Linear interpolation (lerp): currentPosition += (targetPosition - currentPosition) * 0.1
            mesh.position.x += (user.targetPosition.x - mesh.position.x) * 0.1;
            // Center offset: ground is y=0, avatar center is at y=0.9
            const visualTargetY = user.targetPosition.y + 0.9;
            mesh.position.y += (visualTargetY - mesh.position.y) * 0.1;
            mesh.position.z += (user.targetPosition.z - mesh.position.z) * 0.1;

            // Update user state representation to match interpolated position
            user.position.x = mesh.position.x;
            user.position.y = mesh.position.y - 0.9;
            user.position.z = mesh.position.z;

            // Sync with Web Audio spatial panner if initialized
            if (user.audio && user.audio.panner) {
                const panner = user.audio.panner;
                if (panner.positionX) {
                    panner.positionX.value = user.position.x;
                    panner.positionY.value = user.position.y;
                    panner.positionZ.value = user.position.z;
                } else {
                    // Fallback for older browsers
                    panner.setPosition(user.position.x, user.position.y, user.position.z);
                }
            }

            // Interpolate rotation if present
            if (user.targetRotation && typeof user.targetRotation.y === "number") {
                mesh.rotation.y += (user.targetRotation.y - mesh.rotation.y) * 0.1;
                user.rotation.y = mesh.rotation.y;
            }
        }
    }
}

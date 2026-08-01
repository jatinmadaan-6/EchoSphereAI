import * as THREE from "/vendor/three/three.module.js";
import { updateAvatarPosition } from "./avatar.js";
import { getCamera } from "./world.js";


// Tracks active keys for local player movement
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};


// Keyboard input
window.addEventListener("keydown", (e) => {

    // Prevent movement while typing
    if (
        document.activeElement &&
        (
            document.activeElement.tagName === "INPUT" ||
            document.activeElement.tagName === "TEXTAREA"
        )
    ) {
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



// Movement speed
const speed = 0.08;



/**
 * Handles local player movement.
 *
 * Movement is calculated relative to the camera direction:
 *
 * W -> move where camera faces
 * S -> move backwards
 * A -> move left
 * D -> move right
 *
 */
export function updateLocalMovement() {


    const localUser = window.localUser;


    if (
        !localUser ||
        !localUser.position
    ) {
        return;
    }



    let moveX = 0;
    let moveZ = 0;



    // Movement intent
    if (keys.w) moveZ += 1;
    if (keys.s) moveZ -= 1;

    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;



    // No movement
    if (
        moveX === 0 &&
        moveZ === 0
    ) {
        return;
    }



    /*
        Normalize input vector.

        Prevents diagonal movement
        from being faster.

        Example:

        W = speed 1

        W + D = sqrt(2)

    */

    if (
        moveX !== 0 &&
        moveZ !== 0
    ) {

        const length =
            Math.sqrt(
                moveX * moveX +
                moveZ * moveZ
            );


        moveX /= length;
        moveZ /= length;

    }



    const camera = getCamera();


    if (!camera) {
        return;
    }



    /*
        Get camera forward direction.

        Example:

        Looking forward:

        (0,0,-1)


        Looking right:

        (1,0,0)

    */

    const forward =
        new THREE.Vector3();


    camera.getWorldDirection(
        forward
    );


    // Ignore looking up/down
    forward.y = 0;


    forward.normalize();



    /*
        Calculate camera right vector.

        Forward x Up = Right

    */

    const right =
        new THREE.Vector3();


    right.crossVectors(
        forward,
        new THREE.Vector3(0,1,0)
    );


    right.normalize();



    /*
        Convert local movement
        into world movement.

        Forward movement:

        forward * moveZ


        Side movement:

        right * moveX

    */

    localUser.position.x +=
        (
            forward.x * moveZ +
            right.x * moveX
        ) * speed;



    localUser.position.z +=
        (
            forward.z * moveZ +
            right.z * moveX
        ) * speed;



    /*
        Keep player inside world bounds

        World size = 60x60

        Range:
        -30 to +30

    */

    localUser.position.x =
        Math.max(
            -30,
            Math.min(
                30,
                localUser.position.x
            )
        );


    localUser.position.z =
        Math.max(
            -30,
            Math.min(
                30,
                localUser.position.z
            )
        );



    // Update Three.js avatar position

    updateAvatarPosition(
        "local",
        localUser.position
    );



    // Update spatial audio listener

    if (
        typeof window.updateAudioListener === "function"
    ) {

        window.updateAudioListener(
            localUser.position
        );

    }

}
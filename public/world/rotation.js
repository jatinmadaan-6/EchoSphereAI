import * as THREE from "/vendor/three/three.module.js";


let camera;

let yaw = 0;
let pitch = 0;
let pointerLocked = false;


const sensitivity = 0.002;

export function initRotation(activeCamera){

    camera = activeCamera;

}

function handleMouseMove(event){
    if (!pointerLocked || !camera)
        return;

    yaw -= event.movementX * sensitivity;

    pitch -= event.movementY * sensitivity;


    // Limit looking up/down
    pitch = Math.max(
        -Math.PI / 2,
        Math.min(
            Math.PI / 2,
            pitch
        )
    );


    applyCameraRotation();

}

// The follow camera updates its position every frame.  Keep its orientation in
// one place so that follow updates do not undo the latest mouse movement.
export function applyCameraRotation() {
    if (!camera) {
        return;
    }

    camera.rotation.order = "YXZ";
    camera.rotation.set(pitch, yaw, 0);
}

export function enablePointerLock(element){
    // The room UI is layered above the canvas, so a canvas-only listener never
    // receives clicks in normal use. A document listener preserves the user
    // activation needed for pointer lock while leaving controls clickable.
    document.addEventListener(
        "click",
        (event) => {
            if (event.target.closest("button, input, textarea, select, a, label")) {
                return;
            }
            element.requestPointerLock();
        }
    );


    document.addEventListener(
        "pointerlockchange",
        () => {

            pointerLocked =
                document.pointerLockElement === element;

        }
    );


    document.addEventListener(
        "mousemove",
        handleMouseMove
    );
}
export function updateAvatarRotation(){

    const localUser =
        window.localUser;


    if(
        !localUser ||
        !localUser.avatar
    )
    return;


    localUser.rotation.y = yaw;


    localUser.avatar.mesh.rotation.y =
        yaw;

}


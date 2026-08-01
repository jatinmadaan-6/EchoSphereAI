import * as THREE from "/vendor/three/three.module.js";
import { updateRemoteAvatars } from "./avatar.js";
import { updateLocalMovement } from "./movement.js";
import {initCamera, updateCamera}
from "./camera.js";
import {
    applyCameraRotation, initRotation, enablePointerLock, updateAvatarRotation
}
from "./rotation.js";

let scene;
let camera;
let renderer;
let initialized = false;

/**
 * Builds the visual world only. User, networking, and audio state stay in
 * their dedicated modules.
 */
export function initWorld() {
    if (initialized) {
        return;
    }

    initialized = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c14);

    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    window.camera = camera; // Expose for debugging
    initCamera(camera);
    initRotation(camera);
    camera.position.set(8, 7, 10);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    enablePointerLock(
        renderer.domElement
    );

    const container = document.getElementById("world-container") || document.body;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.HemisphereLight(0xb8c7ff, 0x1b2135, 2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(8, 12, 6);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.MeshStandardMaterial({ color: 0x18203a, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(60, 60, 0x6c63ff, 0x2b3454);
    grid.position.y = 0.01;
    scene.add(grid);

    window.addEventListener("resize", handleResize);
    animate();
}

export function animate() {

    requestAnimationFrame(animate);


    updateLocalMovement();

    updateRemoteAvatars();
    updateAvatarRotation();

    if (
        window.localUser &&
        window.localUser.avatar
    ) {
        updateCamera(
            window.localUser.avatar.mesh
        );
        applyCameraRotation();
    }


    renderer.render(
        scene,
        camera
    );
}

export function getScene() {
    return scene;
}

export function getCamera() {
    return camera;
}

function handleResize() {
    if (!camera || !renderer) {
        return;
    }

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

import * as THREE from "/vendor/three/three.module.js";


let camera;


export function initCamera(activeCamera){

    camera = activeCamera;

}


export function updateCamera(target){

    if(!camera || !target)
        return;


    const offset =
        new THREE.Vector3(
            0,
            5,
            8
        );


    camera.position.copy(
        target.position
            .clone()
            .add(offset)
    );


    camera.lookAt(
        target.position
    );

}
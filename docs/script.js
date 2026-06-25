const audioContext = new AudioContext();

document.getElementById("startButton").addEventListener("click", async () => {

    await audioContext.resume();

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
    });

    const source = audioContext.createMediaStreamSource(stream);

    const gain = audioContext.createGain();
    gain.gain.value = 1;

    const panner = audioContext.createPanner();

    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";

    // Position the sound slightly to the left
    panner.positionX.value = -2;
    panner.positionY.value = 0;
    panner.positionZ.value = -1;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(audioContext.destination);

    console.log("Microphone connected successfully!");
});
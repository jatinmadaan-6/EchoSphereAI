const audio = new Audio("../Data/HansZimmer.mp3");

const audioContext = new AudioContext();
const source = audioContext.createMediaElementSource(audio);

const panner = audioContext.createPanner();

source.connect(panner);
panner.connect(audioContext.destination);

document.getElementById("playBtn").addEventListener("click", async () => {

    await audioContext.resume();

    // Start on the left
    panner.positionX.value = -5;
    panner.positionY.value = 0;
    panner.positionZ.value = 0;

    audio.currentTime = 0;
    audio.play();

    // Move to the right after 3 seconds
    setTimeout(() => {
        panner.positionX.value = 5;
    }, 3000);
});


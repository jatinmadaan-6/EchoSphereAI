# EchoSphere AI - Web Audio API Notes

## Why Web Audio API?

Normally, audio is simply received and played through speakers.

In EchoSphere, we need to process audio before playback. We want to:

* Control volume
* Create 3D spatial audio
* Simulate real-world sound behavior
* Analyze audio for avatar interactions

For this processing pipeline, we use the **Web Audio API**.

---

## AudioContext()

The entry point of the Web Audio API.

Think of it as the audio equivalent of `main()` in C++.

---

## AudioNode

Everything in the audio pipeline is represented as an AudioNode.

Examples:

* Audio input
* Volume control
* Spatialization
* Audio analysis
* Speaker output

Audio flows through these connected nodes.

---

## GainNode()

Controls audio volume.

Used to increase or decrease the loudness of a user's voice.

---

## PannerNode()

Responsible for 3D spatial audio.

It makes audio appear to originate from a position in virtual space rather than directly from the headphones.

---

## HRTF (Head Related Transfer Function)

Used with the PannerNode.

HRTF simulates how sound interacts with the listener's:

* Head
* Ears (Pinna)
* Shoulders

Without HRTF, PannerNode only provides basic left-right stereo panning.

With HRTF, sound can realistically appear in front, behind, above, or below the listener.

---

## AnalyserNode()

Extracts information from audio.

Can be used to:

* Detect speaking activity
* Drive avatar animations
* Create voice indicators and visualizers

---

## Audio Graph

An Audio Graph is the audio processing pipeline formed by interconnected AudioNodes.

Example:

```text
Voice Stream
      ↓
GainNode
      ↓
PannerNode (HRTF)
      ↓
AnalyserNode
      ↓
Speakers
```

It is called a graph because the audio path can branch into multiple processing chains.

---

## EchoSphere Audio Pipeline

```text
Microphone
      ↓
WebRTC
      ↓
MediaStreamSource
      ↓
GainNode
      ↓
PannerNode (HRTF)
      ↓
AnalyserNode
      ↓
Destination (Headphones)
```

The PannerNode receives avatar position data from Three.js and spatializes audio accordingly. Distance attenuation is applied so that nearby users sound louder and distant users sound quieter.

---

## One-Line Interview Explanation

EchoSphere uses WebRTC for voice transmission and the Web Audio API for audio processing. Incoming audio streams pass through an audio graph containing GainNodes, PannerNodes, and AnalyserNodes. The PannerNode uses HRTF-based binaural spatialization and Three.js avatar positions to create realistic 3D voice communication.

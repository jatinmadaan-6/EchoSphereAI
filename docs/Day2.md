# Web Audio API Notes

---

# `navigator.mediaDevices.getUserMedia()`

`navigator.mediaDevices.getUserMedia(constraints)` is a **Browser API** (Web API) provided by the browser.

Unlike a typical REST API, which communicates with a remote server over the internet, a Browser API interacts with the **user's device** through the browser.

Its purpose is to request access to the user's **microphone** and/or **camera**.

---

## `navigator`

`navigator` is a **global object** provided by the browser.

> It is **not created by JavaScript itself**. The browser creates and exposes global objects like `window`, `document`, and `navigator` before any JavaScript code executes.

It provides information about the browser and access to browser capabilities.

Examples:

* Browser information
* Geolocation
* Media devices
* Clipboard
* Bluetooth

---

## `mediaDevices`

`navigator.mediaDevices` provides access to media hardware connected to the computer.

Examples include:

* Microphones
* Cameras
* Speakers (device information)

It exposes methods like:

```javascript
getUserMedia()

enumerateDevices()

getDisplayMedia()
```

---

## `getUserMedia()`

Requests permission to access the user's microphone and/or camera.

### Syntax

```javascript
navigator.mediaDevices.getUserMedia(constraints)
```

The method accepts a **constraints object**.

Example:

```javascript
{
    audio: true,
    video: true
}
```

The constraints specify what media the application wants.

They can also configure audio/video properties such as:

* `echoCancellation`
* `noiseSuppression`
* `autoGainControl`
* `sampleRate`
* `channelCount`
* `deviceId`

Example:

```javascript
{
    audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
    }
}
```

---

## Why is it asynchronous?

Accessing media devices takes time.

The browser must:

* Ask the user for permission.
* Wait for the user's response.
* Initialize the selected device.
* Start streaming media.

Therefore, `getUserMedia()` returns a **Promise**.

---

## Permission Model

The browser **does not decide** whether access is granted.

It simply displays a permission prompt.

```text
Allow microphone access?

Allow
Deny
```

The **user** decides.

If permission is granted, the Promise resolves with a **MediaStream**.

---

# What is a MediaStream?

A **MediaStream** represents a **live stream of audio and/or video**.

It is **not** an audio file.

Instead, it represents an active connection to the media source.

```text
Microphone

↓

MediaStream

↓

Application
```

A `MediaStream` consists of one or more `MediaStreamTrack`s.

---

# MediaStreamAudioSourceNode

`getUserMedia()` returns a **MediaStream**, not an **AudioNode**.

However, the Web Audio API only processes **AudioNodes**.

To convert a `MediaStream` into an AudioNode, we create a `MediaStreamAudioSourceNode`.

```javascript
const source = audioContext.createMediaStreamSource(stream);
```

Notice that `MediaStreamAudioSourceNode` is **not instantiated directly**.

Instead, it is created through the `AudioContext`.

```text
MediaStream

↓

MediaStreamAudioSourceNode

↓

Audio Graph
```

Now it can be connected to nodes like:

* GainNode
* PannerNode
* AnalyserNode
* DelayNode

---

# Difference Between an Audio Source and an Audio File

## Audio File

An audio file is **stored audio data**.

Examples:

* MP3
* WAV
* OGG

It does nothing until it is played.

---

## Audio Source

An audio source is **anything currently producing audio samples**.

Examples:

* Microphone
* Playing MP3
* Oscillator
* Remote WebRTC audio

> A playing MP3 is an audio source. An MP3 sitting on disk is simply an audio file.

---

# Why AudioContext Acts as the Processing Environment

Technically, the **AudioContext is not the processing graph**.

The processing graph is the network of connected `AudioNode`s.

The `AudioContext` is the environment that owns and manages that graph.

Think of it as a **recording studio**.

It provides:

* Audio engine
* Audio clock
* Sample rate
* Audio processing thread
* Node creation
* Connection management
* Final output (`destination`)

Everything in the Web Audio API exists inside an `AudioContext`.

```text
AudioContext

├── Source Node
├── GainNode
├── PannerNode
├── AnalyserNode
└── Destination
```

Without an `AudioContext`, AudioNodes have nowhere to exist or execute.

---

# Complete Audio Flow

```text
User Speaks

↓

getUserMedia()

↓

MediaStream

↓

createMediaStreamSource()

↓

MediaStreamAudioSourceNode

↓

GainNode

↓

PannerNode

↓

AnalyserNode (optional)

↓

AudioContext.destination

↓

Speakers
```

---

# Interview One-Liners

### What is `getUserMedia()`?

A Browser API that requests access to the user's microphone and/or camera and returns a live `MediaStream`.

---

### What is a MediaStream?

A live stream of audio/video data captured from a media device.

---

### Why do we need `MediaStreamAudioSourceNode`?

Because `getUserMedia()` returns a `MediaStream`, while the Web Audio API processes only `AudioNode`s. `MediaStreamAudioSourceNode` bridges the two APIs.

---

### What is the difference between an audio source and an audio file?

An audio file is stored audio data. An audio source is anything actively producing audio samples.

---

### What does AudioContext do?

`AudioContext` is the environment that manages the Web Audio API. It creates nodes, manages the audio graph, schedules processing, and sends the final output to the speakers.

---

# Key Takeaways

* Browser APIs interact with the user's device.
* `navigator` is a browser-provided global object.
* `getUserMedia()` requests access to the microphone/camera.
* It returns a live `MediaStream`.
* `MediaStream` is **not** an `AudioNode`.
* `MediaStreamAudioSourceNode` converts a `MediaStream` into an `AudioNode`.
* Audio files are stored data; audio sources actively generate audio samples.
* `AudioContext` is the environment in which all Web Audio processing occurs.

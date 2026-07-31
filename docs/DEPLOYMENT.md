# Deploying EchoSphere

EchoSphere is a small-room WebRTC mesh prototype. Run it with `npm start` and open it over **HTTPS** in production; browsers require a secure context for microphone access (except localhost).

## TURN configuration

STUN alone cannot connect every pair of users behind corporate or symmetric NATs. Configure a TURN service and set these environment variables on the server:

```text
TURN_URL=turn:turn.example.com:3478
TURN_USERNAME=issued-per-session-username
TURN_CREDENTIAL=issued-per-session-credential
```

`STUN_URL` is optional and defaults to Google's public STUN server. In a production deployment, issue short-lived TURN credentials from an authenticated backend instead of storing a permanent credential in the browser configuration response.

## Scope and scaling

This release uses a mesh: each participant maintains a peer connection to every other participant. Keep rooms small (roughly 2–6 users) and migrate media transport to an SFU such as LiveKit or mediasoup when larger rooms are a requirement.

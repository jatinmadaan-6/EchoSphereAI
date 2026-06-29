# Node.js & Networking Foundations --- Concise Notes

## Learning Order

``` text
Computer → OS → Processes → Ports → Networking → HTTP → Server → Express → Socket.io → WebRTC
```

## Processes

-   Process = running program.
-   `node server.js` creates a Node process.

## IP vs Port

-   IP identifies a computer.
-   Port identifies an application.
-   `server.listen(3000)` reserves port 3000 for your Node process.

## Server

A server is simply a program that waits for requests and responds.

## HTTP

Browser ↔ Server communication protocol.

## TCP

Provides reliable communication: - Orders packets - Retransmits lost
packets - Uses ACKs - Creates a connection (3-way handshake)

## Socket

-   Port = entrance
-   Socket = one active conversation

## WebSocket

Keeps a connection open for two-way communication.

## Socket.io

Library built on top of WebSockets with events, rooms, reconnection,
etc.

## Browser Request Flow

``` text
Browser
↓
DNS
↓
IP
↓
TCP
↓
HTTP
↓
Operating System
↓
Node
↓
Express
↓
Route Handler
↓
Response
```

## Node HTTP Server

``` js
const server = http.createServer((req, res) => {
    res.end("Hello");
});

server.listen(3000);
```

-   `req` = incoming request
-   `res` = outgoing response

## Express

Instead of checking `req.url` manually:

``` js
app.get("/about", handler);
```

Express stores:

``` js
routes = [
  {
    route: "/about",
    handler: aboutHandler
  }
]
```

When `/about` is requested:

``` text
Browser → Node → Express → Find Route → Execute Handler
```

**Express calls your handler.**

## Callbacks

A callback is a function passed to another function to be executed
later.

Examples: - `app.get()` - `setTimeout()` - `addEventListener()` -
`socket.on()`

## Event Loop

JavaScript has one thread.

``` js
console.log("Start");

setTimeout(() => console.log("Hello"), 5000);

console.log("End");
```

Output:

``` text
Start
End
Hello
```

Flow:

``` text
Async Work
↓
Callback Queue
↓
Event Loop
↓
Call Stack
```

## Key Takeaways

-   Frameworks are abstractions.
-   Servers wait for requests.
-   Ports identify applications; sockets identify connections.
-   `app.get()` registers a route; it doesn't execute it.
-   Express executes your handler later.
-   Node delegates I/O and uses the Event Loop.

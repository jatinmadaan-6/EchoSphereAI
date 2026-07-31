const assert = require("node:assert/strict");
const test = require("node:test");
const { createApp, isPosition, isText } = require("../server");

test("validates room and position data", () => {
    assert.equal(isText("team-meeting", 64), true);
    assert.equal(isText("", 64), false);
    assert.equal(isText("x".repeat(65), 64), false);
    assert.equal(isPosition({ x: 30, y: 0, z: -30 }), true);
    assert.equal(isPosition({ x: 31, y: 0, z: 0 }), false);
    assert.equal(isPosition({ x: "0", y: 0, z: 0 }), false);
});

test("serves runtime configuration and the Three.js module", async (t) => {
    const { server, io } = createApp();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => io.close(() => server.close(resolve))));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const config = await fetch(`${baseUrl}/config`);
    assert.equal(config.status, 200);
    assert.deepEqual((await config.json()).iceServers.length, 1);
    const three = await fetch(`${baseUrl}/vendor/three/three.module.js`);
    assert.equal(three.status, 200);
});

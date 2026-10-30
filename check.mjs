// node check.mjs — covers the cookie round-trip traps and the identity diff.
import assert from "node:assert/strict";

globalThis.chrome = { cookies: { set: d => d } };
const { writeCookie, liveUid } = await import("./src/cookies.js");
const { diffJars, autoIdentity } = await import("./src/identity.js");

const base = { domain: ".instagram.com", path: "/", secure: true, httpOnly: true,
               sameSite: "no_restriction", hostOnly: false, session: false, expirationDate: 2e9 };

let d = writeCookie({ ...base, name: "sessionid", value: "x" });
assert.equal(d.url, "https://instagram.com/");
assert.equal(d.domain, ".instagram.com");
assert.equal(d.expirationDate, 2e9);

d = writeCookie({ ...base, name: "h", value: "x", domain: "www.instagram.com", hostOnly: true, session: true });
assert.equal(d.url, "https://www.instagram.com/");
assert.ok(!("domain" in d), "hostOnly must omit domain");
assert.ok(!("expirationDate" in d), "session must omit expiry");

assert.ok(!("sameSite" in writeCookie({ ...base, name: "u", value: "", sameSite: "unspecified" })));
assert.equal(writeCookie({ ...base, name: "n", value: "", secure: false }).sameSite, "lax");
assert.ok(!("partitionKey" in writeCookie({ ...base, name: "p", value: "" })));

const c = (name, value) => ({ ...base, name, value });
const a = [c("mid", "M"), c("sessionid", "A1"), c("ds_user_id", "1"), c("onlyA", "z")];
const b = [c("mid", "M"), c("sessionid", "B1"), c("ds_user_id", "2")];
assert.deepEqual(diffJars(a, b).sort(), ["ds_user_id", "onlyA", "sessionid"]);

assert.equal(liveUid(a), "1");
assert.equal(liveUid([c("sessionid", ""), c("ds_user_id", "1")]), undefined, "empty sessionid = logged out");

const accts = { "1": { jar: a, dead: false }, "2": { jar: b, dead: false } };
assert.deepEqual(autoIdentity(accts, "2").sort(), ["ds_user_id", "onlyA", "sessionid"]);
assert.equal(autoIdentity({ ...accts, "2": { jar: b, dead: true } }, "1"), null, "dead partner is skipped");
assert.equal(autoIdentity({ "1": { jar: a }, "3": { jar: a } }, "1"), null, "no sessionid diff = rejected");

const { nextId } = await import("./src/switch.js");
const ring = { a: {}, b: { dead: true }, c: {} };
assert.equal(nextId(ring, "a"), "c", "skips a dead account");
assert.equal(nextId(ring, "c"), "a", "wraps round");
assert.equal(nextId({ a: {} }, "a"), undefined, "no other live account");

const { step } = await import("./src/limit.js");
let t = 1e12, s = { used: 0, last: t, until: 0 };
for (let i = 0; i < 180; i++) s = step(s, t += 1000, true);
assert.equal(s.until, t + 5 * 60e3, "3 visible minutes start the block");
assert.equal(step(s, t + 60e3, true), s, "nothing counts while blocked");
assert.equal(step(s, s.until + 1, true).used, 0, "block ends with a fresh clock");
assert.equal(step({ used: 1e5, last: t, until: 0 }, t + 1000, false).used, 1e5, "hidden tab doesn't count");
assert.equal(step({ used: 1e5, last: t, until: 0 }, t + 6 * 60e3, true).used, 0, "long break resets usage");

console.log("ok");

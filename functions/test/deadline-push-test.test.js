"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../index.js"), "utf8");
const start = source.indexOf("exports.sendDeadlinePushTest = onCall(");
const end = source.indexOf("function validFutureIsoDate(", start);
assert.ok(start >= 0 && end > start);
const handlerSource = source.slice(start, end);

class TestHttpsError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
    }
}

function harness(errorFactory) {
    const deleted = Symbol("deleted");
    const device = {
        enabled: true,
        notificationScopes: ["deadlines"],
        token: "expired-token"
    };
    const merge = patch => {
        for (const [key, value] of Object.entries(patch)) {
            if (value === deleted) delete device[key];
            else device[key] = value;
        }
    };
    const deviceRef = {
        async get() { return {exists: true, data: () => ({...device})}; },
        async set(value) { merge(value); }
    };
    const deviceCollection = {doc: () => deviceRef};
    const deadlineCollection = {where: () => ({get: async () => ({docs: []})})};
    const userRef = {collection: name => name === "pushDevices" ? deviceCollection : deadlineCollection};
    const db = {
        collection: () => ({doc: () => userRef}),
        runTransaction: async callback => callback({
            get: ref => ref.get(),
            set: (_ref, value) => merge(value)
        })
    };
    const firestore = () => db;
    firestore.FieldValue = {
        serverTimestamp: () => "server-time",
        delete: () => deleted
    };
    const context = {
        Date,
        deadlineCalendar: require("../deadline-calendar"),
        exports: {},
        onCall: (_config, handler) => handler,
        HttpsError: TestHttpsError,
        console: {error() {}},
        admin: {
            firestore,
            messaging: () => ({send: async () => { throw errorFactory(device); }})
        },
        pushText: () => ({title: "Synthetic", body: "Synthetic"})
    };
    vm.runInNewContext(handlerSource, context);
    const run = () => context.exports.sendDeadlinePushTest({
        auth: {uid: "owner"},
        data: {deviceId: "11111111-1111-1111-1111-111111111111"}
    });
    return {device, run};
}

test("il test Push invalida il token FCM rifiutato e permette il rinnovo immediato", async () => {
    const h = harness(() => Object.assign(new Error("expired"), {
        code: "messaging/registration-token-not-registered"
    }));
    await assert.rejects(h.run(), error => {
        assert.equal(error.code, "failed-precondition");
        assert.equal(error.details?.reason, "push-token-invalid");
        return true;
    });
    assert.equal(h.device.enabled, false);
    assert.equal(h.device.status, "invalid");
    assert.equal(h.device.lastTestAt, undefined);
});

test("il test Push non disattiva il dispositivo per un errore FCM temporaneo", async () => {
    const h = harness(() => Object.assign(new Error("temporary"), {
        code: "messaging/internal-error"
    }));
    await assert.rejects(h.run(), error => error.code === "internal");
    assert.equal(h.device.enabled, true);
    assert.equal(h.device.status, undefined);
    assert.equal(h.device.lastTestAt, "server-time");
});

test("un token sostituito in parallelo non viene invalidato e può essere ritentato", async () => {
    const h = harness(device => {
        device.token = "replacement-token";
        return Object.assign(new Error("old token rejected"), {
            code: "messaging/invalid-registration-token"
        });
    });
    await assert.rejects(h.run(), error => error.details?.reason === "push-token-invalid");
    assert.equal(h.device.enabled, true);
    assert.equal(h.device.status, undefined);
    assert.equal(h.device.token, "replacement-token");
    assert.equal(h.device.lastTestAt, undefined);
});

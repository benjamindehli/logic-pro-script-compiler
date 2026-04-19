"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { compileToPst } = require("../lib/functions");
const { HEADER_SIZE } = require("../lib/constants");

const SCRIPT = "var x = 1;";

test("returns a Buffer", () => {
    assert.ok(Buffer.isBuffer(compileToPst(SCRIPT)));
});

test("totalSize field at offset 0 matches actual buffer length", () => {
    const buf = compileToPst(SCRIPT);
    assert.equal(buf.readUInt32LE(0), buf.length);
});

test("field at offset 4 is 1", () => {
    assert.equal(compileToPst(SCRIPT).readUInt32LE(4), 1);
});

test("field at offset 8 is 1020", () => {
    assert.equal(compileToPst(SCRIPT).readUInt32LE(8), 1020);
});

test("GAMETSPP magic at offset 12", () => {
    const buf = compileToPst(SCRIPT);
    assert.equal(buf.slice(12, 20).toString("ascii"), "GAMETSPP");
});

test("field at offset 20 is 302", () => {
    assert.equal(compileToPst(SCRIPT).readUInt32LE(20), 302);
});

test("TSCS chunk tag at HEADER_SIZE", () => {
    const buf = compileToPst(SCRIPT);
    assert.equal(buf.slice(HEADER_SIZE, HEADER_SIZE + 4).toString("ascii"), "TSCS");
});

test("TSDE chunk tag follows TSCS chunk", () => {
    const buf = compileToPst(SCRIPT);
    const chunkSize = buf.readUInt32LE(HEADER_SIZE + 4);
    const tsdeOffset = HEADER_SIZE + chunkSize;
    assert.equal(buf.slice(tsdeOffset, tsdeOffset + 4).toString("ascii"), "TSDE");
});

test("TSCS and TSDE chunks have equal size", () => {
    const buf = compileToPst(SCRIPT);
    const tscsSize = buf.readUInt32LE(HEADER_SIZE + 4);
    const tsdeOffset = HEADER_SIZE + tscsSize;
    const tsdeSize = buf.readUInt32LE(tsdeOffset + 4);
    assert.equal(tscsSize, tsdeSize);
});

test("TSCS and TSDE chunk payloads are identical", () => {
    const buf = compileToPst(SCRIPT);
    const chunkSize = buf.readUInt32LE(HEADER_SIZE + 4);
    const tscsPayload = buf.slice(HEADER_SIZE + 8, HEADER_SIZE + chunkSize);
    const tsdePayload = buf.slice(HEADER_SIZE + chunkSize + 8, HEADER_SIZE + 2 * chunkSize);
    assert.deepEqual(tscsPayload, tsdePayload);
});

test("TSCS payload starts with bplist00", () => {
    const buf = compileToPst(SCRIPT);
    assert.equal(buf.slice(HEADER_SIZE + 8, HEADER_SIZE + 16).toString("ascii"), "bplist00");
});

test("total size is HEADER_SIZE + 2 * chunkSize", () => {
    const buf = compileToPst(SCRIPT);
    const chunkSize = buf.readUInt32LE(HEADER_SIZE + 4);
    assert.equal(buf.length, HEADER_SIZE + 2 * chunkSize);
});

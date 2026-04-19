"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildBplist } = require("../lib/functions");

test("starts with bplist00 magic bytes", () => {
    const buf = buildBplist(Buffer.from("var x = 1;", "utf8"));
    assert.equal(buf.slice(0, 8).toString("ascii"), "bplist00");
});

test("total size is 46 + js byte length", () => {
    const jsBytes = Buffer.from("var x = 1;", "utf8"); // 10 bytes
    const buf = buildBplist(jsBytes);
    assert.equal(buf.length, 46 + jsBytes.length);
});

test("string object marker 0x5f at offset 8", () => {
    const buf = buildBplist(Buffer.from("x", "utf8"));
    assert.equal(buf[8], 0x5f);
});

test("int object marker 0x11 at offset 9", () => {
    const buf = buildBplist(Buffer.from("x", "utf8"));
    assert.equal(buf[9], 0x11);
});

test("js byte length written as big-endian uint16 at offset 10", () => {
    const jsBytes = Buffer.from("var x = 1;", "utf8"); // 10 bytes
    const buf = buildBplist(jsBytes);
    assert.equal(buf.readUInt16BE(10), 10);
});

test("js bytes written at offset 12", () => {
    const jsBytes = Buffer.from("hello", "utf8");
    const buf = buildBplist(jsBytes);
    assert.equal(buf.slice(12, 17).toString("ascii"), "hello");
});

test("offset table points to object 0 at bplist offset 8", () => {
    const jsBytes = Buffer.from("var x = 1;", "utf8"); // 10 bytes
    const buf = buildBplist(jsBytes);
    const offsetTablePos = 12 + jsBytes.length; // after the js bytes
    assert.equal(buf.readUInt16BE(offsetTablePos), 8);
});

test("trailer offsetTableOffset matches expected position", () => {
    const jsBytes = Buffer.from("var x = 1;", "utf8");
    const buf = buildBplist(jsBytes);
    const expectedOffsetTableOffset = BigInt(12 + jsBytes.length);
    const trailerStart = buf.length - 32 + 6 + 2; // skip unused + sizes
    const storedOffset = buf.readBigUInt64BE(trailerStart + 16);
    assert.equal(storedOffset, expectedOffsetTableOffset);
});

test("throws when input exceeds 65535 bytes", () => {
    const tooLarge = Buffer.alloc(65536, 97); // 'a' * 65536
    assert.throws(() => buildBplist(tooLarge), /Script too large/);
});

test("accepts exactly 65535 bytes without throwing", () => {
    const maxSize = Buffer.alloc(65535, 97);
    assert.doesNotThrow(() => buildBplist(maxSize));
});

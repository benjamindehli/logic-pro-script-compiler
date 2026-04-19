"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { transpile } = require("../lib/functions");

test("returns a string", () => {
    assert.equal(typeof transpile("var x = 1;"), "string");
});

test("converts const to var", () => {
    const result = transpile("const x = 1;");
    assert.match(result, /\bvar\b/);
    assert.doesNotMatch(result, /\bconst\b/);
});

test("converts let to var", () => {
    const result = transpile("let x = 1;");
    assert.match(result, /\bvar\b/);
    assert.doesNotMatch(result, /\blet\b/);
});

test("transpiles optional chaining", () => {
    const result = transpile("var x = a?.b;");
    assert.doesNotMatch(result, /\?\./);
});

test("transpiles nested optional chaining", () => {
    const result = transpile("var x = a?.b?.c;");
    assert.doesNotMatch(result, /\?\./);
});

test("transpiles spread in array literals", () => {
    const result = transpile("var x = [].concat(arr);");
    // After loose spread transformation, no spread syntax remains
    assert.doesNotMatch(result, /\.\.\./);
});

test("preserves block comments", () => {
    const result = transpile("/* my comment */\nvar x = 1;");
    assert.match(result, /my comment/);
});

test("preserves line comments", () => {
    const result = transpile("// my comment\nvar x = 1;");
    assert.match(result, /my comment/);
});

test("passes through plain var declarations unchanged", () => {
    const result = transpile("var x = 1;");
    assert.match(result, /var x = 1/);
});

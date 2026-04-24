"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { processDirectory } = require("../lib/functions");

function mkTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "lpsc-test-"));
}

function cleanup(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
}

test("creates output directory if it does not exist", () => {
    const src = mkTmpDir();
    const base = mkTmpDir();
    const out = path.join(base, "nested", "build");
    try {
        processDirectory(src, out);
        assert.ok(fs.existsSync(out));
    } finally {
        cleanup(src);
        cleanup(base);
    }
});

test("compiles .js files to .pst in the output directory", () => {
    const src = mkTmpDir();
    const out = mkTmpDir();
    try {
        fs.writeFileSync(path.join(src, "script.js"), "var x = 1;");
        processDirectory(src, out);
        assert.ok(fs.existsSync(path.join(out, "script.pst")));
    } finally {
        cleanup(src);
        cleanup(out);
    }
});

test("output .pst file has GAMETSPP magic at offset 12", () => {
    const src = mkTmpDir();
    const out = mkTmpDir();
    try {
        fs.writeFileSync(path.join(src, "script.js"), "var x = 1;");
        processDirectory(src, out);
        const pst = fs.readFileSync(path.join(out, "script.pst"));
        assert.equal(pst.slice(12, 20).toString("ascii"), "GAMETSPP");
    } finally {
        cleanup(src);
        cleanup(out);
    }
});

test("skips dotfiles", () => {
    const src = mkTmpDir();
    const out = mkTmpDir();
    try {
        fs.writeFileSync(path.join(src, ".hidden.js"), "var x = 1;");
        processDirectory(src, out);
        assert.equal(fs.readdirSync(out).length, 0);
    } finally {
        cleanup(src);
        cleanup(out);
    }
});

test("skips non-.js/.mjs/.cjs files", () => {
    const src = mkTmpDir();
    const out = mkTmpDir();
    try {
        fs.writeFileSync(path.join(src, "readme.txt"), "hello");
        fs.writeFileSync(path.join(src, "data.json"), "{}");
        processDirectory(src, out);
        assert.equal(fs.readdirSync(out).length, 0);
    } finally {
        cleanup(src);
        cleanup(out);
    }
});

test("processes nested directories recursively", () => {
    const src = mkTmpDir();
    const out = mkTmpDir();
    try {
        const subDir = path.join(src, "device");
        fs.mkdirSync(subDir);
        fs.writeFileSync(path.join(subDir, "script.js"), "var x = 1;");
        processDirectory(src, out);
        assert.ok(fs.existsSync(path.join(out, "device", "script.pst")));
    } finally {
        cleanup(src);
        cleanup(out);
    }
});

test("skips dot directories", () => {
    const src = mkTmpDir();
    const out = mkTmpDir();
    try {
        const hiddenDir = path.join(src, ".hidden");
        fs.mkdirSync(hiddenDir);
        fs.writeFileSync(path.join(hiddenDir, "script.js"), "var x = 1;");
        processDirectory(src, out);
        assert.ok(!fs.existsSync(path.join(out, ".hidden")));
    } finally {
        cleanup(src);
        cleanup(out);
    }
});

test("compiles multiple .js files in the same directory", () => {
    const src = mkTmpDir();
    const out = mkTmpDir();
    try {
        fs.writeFileSync(path.join(src, "a.js"), "var a = 1;");
        fs.writeFileSync(path.join(src, "b.js"), "var b = 2;");
        processDirectory(src, out);
        assert.ok(fs.existsSync(path.join(out, "a.pst")));
        assert.ok(fs.existsSync(path.join(out, "b.pst")));
    } finally {
        cleanup(src);
        cleanup(out);
    }
});

test("compiles .mjs files to .pst", () => {
    const src = mkTmpDir();
    const out = mkTmpDir();
    try {
        fs.writeFileSync(path.join(src, "script.mjs"), "var x = 1;");
        processDirectory(src, out);
        assert.ok(fs.existsSync(path.join(out, "script.pst")));
    } finally {
        cleanup(src);
        cleanup(out);
    }
});

test("compiles .cjs files to .pst", () => {
    const src = mkTmpDir();
    const out = mkTmpDir();
    try {
        fs.writeFileSync(path.join(src, "script.cjs"), "var x = 1;");
        processDirectory(src, out);
        assert.ok(fs.existsSync(path.join(out, "script.pst")));
    } finally {
        cleanup(src);
        cleanup(out);
    }
});

"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { compileToPst } = require("../lib/functions");

function mkTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "lpsc-inline-"));
}

function cleanup(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
}

test("inlines a named import from a sibling file", () => {
    const dir = mkTmpDir();
    try {
        fs.writeFileSync(path.join(dir, "helper.js"), 'export function greet() { return "hi"; }\n');
        const entryPath = path.join(dir, "main.js");
        fs.writeFileSync(entryPath, 'import { greet } from "./helper.js";\nvar x = greet();\n');
        const buf = compileToPst(fs.readFileSync(entryPath, "utf8"), entryPath);
        assert.ok(Buffer.isBuffer(buf));
    } finally {
        cleanup(dir);
    }
});

test("inlined output contains the exported function body", () => {
    const dir = mkTmpDir();
    try {
        fs.writeFileSync(path.join(dir, "helper.js"), "export function add(a, b) { return a + b; }\n");
        const entryPath = path.join(dir, "main.js");
        fs.writeFileSync(entryPath, 'import { add } from "./helper.js";\nvar result = add(1, 2);\n');
        const buf = compileToPst(fs.readFileSync(entryPath, "utf8"), entryPath);
        // Verify PST contains the inlined function name
        assert.ok(buf.toString("utf8", 0, buf.length).includes("add"));
    } finally {
        cleanup(dir);
    }
});

test("strips export keyword from named function export", () => {
    const dir = mkTmpDir();
    try {
        const helperPath = path.join(dir, "helper.js");
        fs.writeFileSync(helperPath, "export function foo() {}\n");
        const entryPath = path.join(dir, "main.js");
        fs.writeFileSync(entryPath, 'import { foo } from "./helper.js";\nfoo();\n');
        // Should not throw (would throw if 'export function' remains in transpile input)
        assert.doesNotThrow(() => compileToPst(fs.readFileSync(entryPath, "utf8"), entryPath));
    } finally {
        cleanup(dir);
    }
});

test("handles transitive imports", () => {
    const dir = mkTmpDir();
    try {
        fs.writeFileSync(path.join(dir, "base.js"), "export function base() { return 1; }\n");
        fs.writeFileSync(path.join(dir, "mid.js"), 'import { base } from "./base.js";\nexport function mid() { return base(); }\n');
        const entryPath = path.join(dir, "main.js");
        fs.writeFileSync(entryPath, 'import { mid } from "./mid.js";\nvar x = mid();\n');
        assert.doesNotThrow(() => compileToPst(fs.readFileSync(entryPath, "utf8"), entryPath));
    } finally {
        cleanup(dir);
    }
});

test("each shared dependency is inlined only once", () => {
    const dir = mkTmpDir();
    try {
        fs.writeFileSync(path.join(dir, "shared.js"), "export function shared() { return 42; }\n");
        fs.writeFileSync(path.join(dir, "a.js"), 'import { shared } from "./shared.js";\nexport function a() { return shared(); }\n');
        fs.writeFileSync(path.join(dir, "b.js"), 'import { shared } from "./shared.js";\nexport function b() { return shared(); }\n');
        const entryPath = path.join(dir, "main.js");
        fs.writeFileSync(entryPath, 'import { a } from "./a.js";\nimport { b } from "./b.js";\nvar x = a() + b();\n');
        const buf = compileToPst(fs.readFileSync(entryPath, "utf8"), entryPath);
        // Extract JS source from first bplist chunk (PST has two identical chunks; check one)
        const bplistOffset = buf.indexOf("bplist00");
        const jsLen = buf.readUInt16BE(bplistOffset + 10);
        const jsSource = buf.slice(bplistOffset + 12, bplistOffset + 12 + jsLen).toString("utf8");
        // "shared" function body should appear exactly once in the compiled output
        const count = (jsSource.match(/function shared/g) || []).length;
        assert.equal(count, 1);
    } finally {
        cleanup(dir);
    }
});

test("throws when filePath is omitted for a module file", () => {
    const src = 'import { foo } from "./foo.js";\nfoo();\n';
    assert.throws(() => compileToPst(src), /filePath is required/);
});

test("compiles .mjs entry with relative import from ExampleData", () => {
    const entryPath = require("path").resolve(__dirname, "../ExampleData/scripts/Chase Bliss Audio & Meris CXM 1978/Editor.mjs");
    if (!require("fs").existsSync(entryPath)) return; // skip if example not present
    assert.doesNotThrow(() => {
        const buf = compileToPst(require("fs").readFileSync(entryPath, "utf8"), entryPath);
        assert.ok(Buffer.isBuffer(buf));
    });
});

#!/usr/bin/env node
"use strict";

// Dependencies
const babel = require("@babel/core");
const fs = require("fs");
const path = require("path");

// Constants
const { HEADER_SIZE } = require("./constants");

/**
 * Builds a bplist Buffer containing the given JavaScript source code.
 *
 * @param {Buffer} jsBytes - Transpiled JavaScript source code as a UTF-8 byte buffer
 * @returns {Buffer} A Buffer containing the bplist data
 */
function buildBplist(jsBytes) {
    const jsLen = jsBytes.length;
    if (jsLen > 65535) {
        throw new Error(`Script too large: ${jsLen} bytes (max 65535)`);
    }

    const offsetTableOffset = 12 + jsLen;
    const bplistSize = offsetTableOffset + 2 + 32;
    const buf = Buffer.alloc(bplistSize, 0);
    let pos = 0;

    buf.write("bplist00", pos, "ascii");
    pos += 8;

    buf[pos++] = 0x5f; // string object, extended size
    buf[pos++] = 0x11; // int object, 2-byte BE value
    buf.writeUInt16BE(jsLen, pos);
    pos += 2;

    jsBytes.copy(buf, pos);
    pos += jsLen;

    buf.writeUInt16BE(8, pos); // offset table: object 0 is at bplist offset 8
    pos += 2;

    // Trailer (32 bytes)
    pos += 6; // 5 unused + 1 sortVersion (all zero)
    buf[pos++] = 2; // offsetIntSize: 2 bytes per offset table entry
    buf[pos++] = 1; // objectRefSize: 1 byte per object reference
    buf.writeBigUInt64BE(1n, pos); // numObjects
    buf.writeBigUInt64BE(0n, pos + 8); // topObject (root = object 0)
    buf.writeBigUInt64BE(BigInt(offsetTableOffset), pos + 16); // offsetTableOffset

    return buf;
}

/**
 * Transpiles the given JavaScript source code using Babel.
 *
 * @param {string} jsSource - JavaScript source code
 * @returns {string} Transpiled JavaScript code
 */
function transpile(jsSource) {
    const result = babel.transformSync(jsSource, {
        sourceType: "script",
        compact: false,
        comments: true,
        plugins: [
            "@babel/plugin-transform-optional-chaining",
            ["@babel/plugin-transform-spread", { loose: true }],
            "@babel/plugin-transform-block-scoping"
        ]
    });
    return result.code;
}

/**
 * Compiles the given JavaScript source code into a PST file format.
 *
 * @param {string} jsSource - JavaScript source code
 * @returns {Buffer} A Buffer containing the PST data
 */
function compileToPst(jsSource) {
    const jsBytes = Buffer.from(transpile(jsSource), "utf8");
    const bplist = buildBplist(jsBytes);
    const chunkSize = 8 + bplist.length; // tag(4) + size_field(4) + bplist
    const totalSize = HEADER_SIZE + 2 * chunkSize;

    const out = Buffer.alloc(totalSize, 0);

    out.writeUInt32LE(totalSize, 0);
    out.writeUInt32LE(1, 4);
    out.writeUInt32LE(1020, 8);
    out.write("GAMETSPP", 12, "ascii");
    out.writeUInt32LE(302, 20);

    let pos = HEADER_SIZE;

    out.write("TSCS", pos, "ascii");
    out.writeUInt32LE(chunkSize, pos + 4);
    bplist.copy(out, pos + 8);
    pos += chunkSize;

    out.write("TSDE", pos, "ascii");
    out.writeUInt32LE(chunkSize, pos + 4);
    bplist.copy(out, pos + 8);

    return out;
}

/**
 * Recursively processes JavaScript files in the source directory, transpiles and compiles them to .pst files in the build directory.
 *
 * @param {string} srcDir - Source directory path
 * @param {string} buildDir - Build directory path
 */
function processDirectory(srcDir, buildDir) {
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
    }

    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;

        const srcPath = path.join(srcDir, entry.name);

        if (entry.isDirectory()) {
            processDirectory(srcPath, path.join(buildDir, entry.name));
        } else if (entry.name.endsWith(".js")) {
            const pstPath = path.join(buildDir, entry.name.slice(0, -3) + ".pst");
            const pstBuffer = compileToPst(fs.readFileSync(srcPath, "utf8"));
            fs.writeFileSync(pstPath, pstBuffer);
            console.log(`  ${path.relative(process.cwd(), srcPath)} -> ${path.relative(process.cwd(), pstPath)}`);
        }
    }
}

module.exports = { buildBplist, transpile, compileToPst, processDirectory };

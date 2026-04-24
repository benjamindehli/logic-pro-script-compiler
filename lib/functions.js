#!/usr/bin/env node
"use strict";

// Dependencies
const babel = require("@babel/core");
const { parse } = require("@babel/parser");
const fs = require("node:fs");
const path = require("node:path");

// Constants
const { HEADER_SIZE } = require("./constants");

// Logic Pro stores parameter values as float32 LE starting at this header offset
const PARAM_HEADER_OFFSET = 104;

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
            require("@babel/plugin-transform-optional-chaining"),
            [require("@babel/plugin-transform-spread"), { loose: true }],
            require("@babel/plugin-transform-block-scoping")
        ]
    });
    return result.code;
}

/**
 * Recursively inlines ES module imports into a single flat script suitable for Logic Pro Scripter.
 * Import statements are replaced with the content of the imported file; export keywords are stripped.
 *
 * @param {string} filePath - Absolute path to the entry module file
 * @param {Set<string>} visited - Tracks already-inlined files to prevent duplicate inlining
 * @returns {string} Flat JavaScript source with all imports inlined
 */
function inlineModules(filePath, visited = new Set()) {
    if (visited.has(filePath)) return "";
    visited.add(filePath);

    const source = fs.readFileSync(filePath, "utf8");
    const dir = path.dirname(filePath);

    const importRegex = /^[ \t]*import\b[^'"]*["']([^"']+)["'];?[ \t]*(?:\r?\n|$)/gm;
    const specifiers = [...source.matchAll(importRegex)].map((m) => m[1]);
    const strippedSource = source.replace(importRegex, "");

    const parts = specifiers.map((specifier) => inlineModules(path.resolve(dir, specifier), visited));

    const exportStripped = strippedSource
        .replace(/^export\s+default\s+(function|class)(\s)/gm, "$1$2")
        .replace(/^export\s+default\s+/gm, "var _moduleDefault = ")
        .replace(/^export\s+(function|class|var|let|const)\s/gm, "$1 ")
        .replace(/^export\s*\{[^}]*\}(?:\s+from\s+["'][^"']*["'])?;?[ \t]*(?:\r?\n|$)/gm, "");

    return [exportStripped, ...parts].join("\n");
}

/**
 * Parses the PluginParameters array from the JS source and returns an ordered list of
 * defaultValue numbers (one entry per parameter, including text-type params which use 0).
 *
 * @param {string} jsSource - JavaScript source code
 * @returns {number[]} Default values for each PluginParameters entry
 */
function extractParamDefaults(jsSource) {
    try {
        const ast = parse(jsSource, { sourceType: "unambiguous", errorRecovery: true });
        for (const node of ast.program.body) {
            if (node.type !== "VariableDeclaration") continue;
            for (const decl of node.declarations) {
                if (decl.id.name === "PluginParameters" && decl.init?.type === "ArrayExpression") {
                    return decl.init.elements.map((el) => {
                        if (!el || el.type !== "ObjectExpression") return 0;
                        const prop = el.properties.find(
                            (p) => p.key && (p.key.name === "defaultValue" || p.key.value === "defaultValue")
                        );
                        if (!prop) return 0;
                        const val = prop.value;
                        if (val.type === "NumericLiteral") return val.value;
                        if (val.type === "UnaryExpression" && val.operator === "-" && val.argument.type === "NumericLiteral")
                            return -val.argument.value;
                        return 0;
                    });
                }
            }
        }
    } catch (_) {}
    return [];
}

/**
 * Compiles the given JavaScript source code into a PST file format.
 *
 * @param {string} jsSource - JavaScript source code
 * @param {string|null} filePath - Absolute path to the source file; required when jsSource uses import/export
 * @returns {Buffer} A Buffer containing the PST data
 */
function compileToPst(jsSource, filePath = null) {
    const isModule = /^\s*import\s/m.test(jsSource) || /^\s*export\s/m.test(jsSource);
    if (isModule && !filePath) {
        throw new Error("filePath is required to compile ES module files with import/export syntax");
    }
    const sourceToCompile = isModule ? inlineModules(path.resolve(filePath)) : jsSource;
    const jsBytes = Buffer.from(transpile(sourceToCompile), "utf8");
    const bplist = buildBplist(jsBytes);
    const chunkSize = 8 + bplist.length; // tag(4) + size_field(4) + bplist
    const totalSize = HEADER_SIZE + 2 * chunkSize;

    const out = Buffer.alloc(totalSize, 0);

    out.writeUInt32LE(totalSize, 0);
    out.writeUInt32LE(1, 4);
    out.writeUInt32LE(1020, 8);
    out.write("GAMETSPP", 12, "ascii");
    out.writeUInt32LE(302, 20);

    // Extract defaults from original source (PluginParameters is always in the entry file)
    const paramDefaults = extractParamDefaults(jsSource);
    for (let i = 0; i < paramDefaults.length; i++) {
        const offset = PARAM_HEADER_OFFSET + i * 4;
        if (offset + 4 > HEADER_SIZE) break;
        out.writeFloatLE(paramDefaults[i], offset);
    }

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
        } else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
            const pstPath = path.join(buildDir, entry.name.replace(/\.(js|mjs|cjs)$/, ".pst"));
            const pstBuffer = compileToPst(fs.readFileSync(srcPath, "utf8"), srcPath);
            fs.writeFileSync(pstPath, pstBuffer);
            console.log(`  ${path.relative(process.cwd(), srcPath)} -> ${path.relative(process.cwd(), pstPath)}`);
        }
    }
}

module.exports = { buildBplist, transpile, extractParamDefaults, compileToPst, processDirectory };

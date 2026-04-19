#!/usr/bin/env node
"use strict";

// Dependencies
const path = require("node:path");

// Helpers
const { processDirectory } = require("./lib/functions");

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: logic-pro-script-compiler [options]

Options:
  -i, --input <dir>   Input directory containing .js files (default: ./src)
  -o, --output <dir>  Output directory for .pst files (default: ./build)
  -h, --help          Show this help message`);
    process.exit(0);
}

function getArg(flags) {
    for (let i = 0; i < args.length - 1; i++) {
        if (flags.includes(args[i])) return args[i + 1];
    }
    return null;
}

const srcDir = path.resolve(process.cwd(), getArg(["--input", "-i"]) ?? "src");
const buildDir = path.resolve(process.cwd(), getArg(["--output", "-o"]) ?? "build");

console.log("Compiling Logic Pro Scripter files...");
processDirectory(srcDir, buildDir);
console.log("Done.");

#!/usr/bin/env node
"use strict";

// Dependencies
const path = require("path");

// Functions
const { buildBplist, compileToPst, processDirectory, transpile } = require("./lib/functions");

const srcDir = path.resolve(__dirname, "src");
const buildDir = path.resolve(__dirname, "build");

console.log("Compiling Logic Pro Scripter files...");
processDirectory(srcDir, buildDir);
console.log("Done.");

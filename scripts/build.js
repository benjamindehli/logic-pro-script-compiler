"use strict";

const esbuild = require("esbuild");
const fs = require("fs");

const sharedOptions = {
    bundle: true,
    platform: "node",
    format: "cjs",
    minify: true,
    // @babel/core optionally checks for these presets at runtime via try/catch
    external: ["@babel/preset-typescript", "@babel/preset-flow"]
};

// Remaps require("./lib/functions") in compile.js to require("./functions")
// so the CLI references the adjacent bundled dist/functions.js instead of rebundling Babel
const remapFunctionsPlugin = {
    name: "remap-functions",
    setup(build) {
        build.onResolve({ filter: /^\.\/lib\/functions$/ }, () => ({
            path: "./functions",
            external: true
        }));
    }
};

async function build() {
    // Bundle lib/functions.js first — this is where Babel lives
    await esbuild.build({
        ...sharedOptions,
        entryPoints: ["lib/functions.js"],
        outfile: "dist/functions.js"
    });

    // Bundle compile.js without re-bundling Babel — it requires ./functions at runtime
    await esbuild.build({
        ...sharedOptions,
        entryPoints: ["compile.js"],
        outfile: "dist/compile.js",
        plugins: [remapFunctionsPlugin]
    });

    fs.chmodSync("dist/compile.js", 0o755);
    console.log("Build complete.");
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});

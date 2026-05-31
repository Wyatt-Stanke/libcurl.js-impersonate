#!/usr/bin/env node
import { $ } from "execa";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const USAGE = `Usage: node scripts/edit-patches.js {apply|save|status}

apply   Reset patched files
save    Regenerate .patch files
status  Show which patched files differ from their original`

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATCHES_DIR = join(__dirname, "patches");
const LIBCURL_JS_DIR = join(__dirname, "libcurl.js");
const CLIENT_DIR = join(LIBCURL_JS_DIR, "client");

const die = (msg) => {
    console.error(`ERROR: ${msg}`);
    process.exit(1);
};

const patchTargets = (patchPath) =>
    readFileSync(patchPath, "utf8")
        .split("\n")
        .filter((l) => l.startsWith("+++ b/"))
        .map((l) => l.slice("+++ b/".length));

const listPatches = () =>
    readdirSync(PATCHES_DIR)
        .filter((f) => f.endsWith(".patch"))
        .sort()
        .map((f) => join(PATCHES_DIR, f));

const requireSubmodule = () => {
    if (!existsSync(join(LIBCURL_JS_DIR, "README.md")))
        die("Submodule not found. Please run: git submodule update --init");
};

async function diffTarget(rel) {
    const absPath = join(CLIENT_DIR, rel);
    const { stdout: orig } = await $({ cwd: LIBCURL_JS_DIR })`git show HEAD:client/${rel}`;
    const { stdout: diff, exitCode } = await $({ input: orig, reject: false })`diff -u --label=a/${rel} --label=b/${rel} - ${absPath}`;
    if (exitCode > 1) die(`diff failed for ${rel}`);
    return { diff, changed: exitCode === 1 };
}

async function cmdApply() {
    requireSubmodule();

    const patches = listPatches();
    if (!patches.length) die(`No .patch files found in ${PATCHES_DIR}`);

    const gitPaths = patches.flatMap((p) => patchTargets(p).map((rel) => `client/${rel}`));
    if (!gitPaths.length) die("No target files found in patch headers.");

    console.log("Resetting patched files to git originals");
    await $({ cwd: LIBCURL_JS_DIR, stdio: "inherit" })`git checkout -- ${gitPaths}`;

    console.log("Applying patches");
    for (const patchPath of patches) {
        await $({ cwd: CLIENT_DIR, inputFile: patchPath, stdio: ["pipe", "inherit", "inherit"] })`patch -p1`;
    }

    console.log("\nDone. Edit files in:", CLIENT_DIR);
    for (const rel of patches.flatMap(patchTargets)) console.log("  ", join(CLIENT_DIR, rel));
    console.log("\nWhen finished editing, run: node scripts/edit-patches.js save");
}

async function cmdSave() {
    requireSubmodule();
    console.log("Regenerating patches");

    for (const patchPath of listPatches()) {
        const name = `patches/${patchPath.split("/").at(-1)}`;
        const targets = patchTargets(patchPath).filter((rel) => {
            if (existsSync(join(CLIENT_DIR, rel))) return true;
            console.warn(`WARNING: target not found: ${rel} (skipped)`);
            return false;
        });

        const diffs = await Promise.all(targets.map(diffTarget));
        const combined = diffs.map((d) => d.diff).join("");

        if (combined) {
            writeFileSync(patchPath, combined);
            console.log(`Saved: ${name}`);
        } else {
            console.log(`UNCHANGED (no diff): ${name}`);
        }
    }

    console.log("\nDone");
}

async function cmdStatus() {
    requireSubmodule();
    let anyModified = false;

    for (const patchPath of listPatches()) {
        for (const rel of patchTargets(patchPath)) {
            if (!existsSync(join(CLIENT_DIR, rel))) continue;
            const { changed } = await diffTarget(rel);
            console.log(changed ? `MODIFIED: ${rel}` : `unchanged: ${rel}`);
            anyModified ||= changed;
        }
    }

    if (!anyModified) console.log("(all patched files match their current patch)");
}

const commands = { apply: cmdApply, save: cmdSave, status: cmdStatus };
const run = commands[process.argv[2]];

if (!run) {
    console.error(USAGE);
    process.exit(1);
}

await run();
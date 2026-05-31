import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { server as wispServer } from "@mercuryworkshop/wisp-js/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT) : 7891;

const MIME = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".wasm": "application/wasm",
    ".css": "text/css",
    ".json": "application/json",
};

function serveFile(filePath, res) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, {
            "Content-Type": MIME[ext] ?? "application/octet-stream",
        });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, `http://localhost`).pathname;

    if (pathname === "/" || pathname === "/tests/page.html") {
        serveFile(path.join(ROOT, "tests", "page.html"), res);
    } else if (pathname.startsWith("/out/")) {
        serveFile(path.join(ROOT, pathname), res);
    } else if (pathname.startsWith("/tests/")) {
        serveFile(path.join(ROOT, pathname), res);
    } else {
        res.writeHead(404);
        res.end("Not found");
    }
});

server.on("upgrade", (req, socket, head) => {
    if (req.url.startsWith("/ws/")) {
        wispServer.routeRequest(req, socket, head);
    } else {
        socket.destroy();
    }
});

server.listen(PORT, () => {
    console.log(`Test server listening on http://localhost:${PORT}`);
});

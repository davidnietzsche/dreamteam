const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 9999;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const cleanUrl = (req.url || "/").split("?")[0];
  const requestedPath = cleanUrl === "/" ? "/index.html" : cleanUrl;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");

  const baseDir = safePath.startsWith("/data/") ? DATA_DIR : PUBLIC_DIR;
  const relativePath = safePath.startsWith("/data/") ? safePath.replace(/^\/data/, "") : safePath;
  const filePath = path.join(baseDir, relativePath);

  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      sendFile(path.join(filePath, "index.html"), res);
      return;
    }

    sendFile(filePath, res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Elon Musk Pixel running at http://127.0.0.1:${PORT}`);
});

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(process.cwd(), "public");

http.createServer((req, res) => {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/index.html";
  const file = path.join(root, url);

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.end(data);
  });
}).listen(3000, () => {
  console.log("OK http://localhost:3000");
});

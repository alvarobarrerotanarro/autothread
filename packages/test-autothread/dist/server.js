import "./config.js";
import express from "express";
const app = express();
app.use(express.static("src/assets"));
app.use("/js", express.static("dist/assets"));
const port = process.env["PORT"] || 3000;
app.listen(port, () => {
    console.log(`Server listening at: http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map
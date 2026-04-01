import express from "express";

const app = express();
const PORT = 8000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Livesportz API!");
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

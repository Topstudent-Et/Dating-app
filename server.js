const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();

// 🔐 API KEY (ከ Render env ይመጣ)
const av_uat_0e4c02382ab0b67e6131fda46344eb9f = process.env.av_uat_0e4c02382ab0b67e6131fda46344eb9f;

app.use(express.static("public"));

app.get("/api/aviator", async (req, res) => {
  try {
    const response = await fetch("https://api.example.com/aviator", {
      headers: { Authorization: API_KEY }
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ error: "API error" });
  }
});

app.listen(3000, () => console.log("Server running"));

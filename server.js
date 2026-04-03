const express = require("express");
const fetch = require("node-fetch");

const app = express();

// 🔐 API key (av_uat_0e4c02382ab0b67e6131fda46344eb9f)
const API_KEY = process.env.API_KEY;

// HTML serve
app.use(express.static("public"));

// API route
app.get("/api/aviator", async (req, res) => {
  try {
    const response = await fetch("https://api.example.com/aviator", {
      headers: {
        Authorization: API_KEY
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ error: "API error" });
  }
});

// PORT fix
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));

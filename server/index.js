import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import geminiProxy from "./geminiProxy.js";

dotenv.config();

const app = express();

// ✅ Fixed: Removed trailing slashes
app.use(cors({
  origin: [
    "http://localhost:8080",
    "http://localhost:5173",
    "https://dronex-alert-now.vercel.app",  // ✅ Your production URL
    "https://dronex-alert-now-git-main-venkats-projects-0c1df854.vercel.app",  // Git branch URL
    /^https:\/\/dronex-alert-[a-z0-9-]+\.vercel\.app$/  // All preview deployments
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use("/api", geminiProxy);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 SERVER RUNNING ON PORT: ${PORT}`);
});


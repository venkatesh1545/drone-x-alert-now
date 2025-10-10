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
    "http://10.16.61.204:8080",
    "https://dronex-copy.onrender.com",
    "https://dronex-alert-now.vercel.app",
    /\.vercel\.app$/  // Allow all Vercel preview deployments
  ],
  credentials: true
}));

app.use(express.json());
app.use("/api", geminiProxy);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 SERVER RUNNING ON PORT: ${PORT}`);
});

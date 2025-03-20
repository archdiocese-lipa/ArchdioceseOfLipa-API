require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const inviteRoutes = require("./routes/invite");
const publicRoutes = require("./routes/publicRoutes");
const authMiddleware = require("./middleware/auth");

const corsOptions = {
  origin: [
    "https://localhost:5173",
    "https://togatherinv1.vercel.app",
    "https://portal.saintlaurence.org.uk",
    process.env.FRONTEND_URL,
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Access-Control-Allow-Origin"],
  credentials: true,
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

// Apply CORS middleware with options
app.use(cors(corsOptions));

// Add custom CORS headers middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (corsOptions.origin.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Routes
app.use("/", publicRoutes);
app.use("/accept-invite", publicRoutes);
app.use("/invite", authMiddleware, inviteRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

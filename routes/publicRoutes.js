const express = require("express");
const router = express.Router();
const { acceptInvite } = require("../services/inviteService");
const validateAcceptInvite = require("../middleware/validateAcceptInvite");

// Validate token
const isValidToken = (token) => {
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
};

// GET accept-invite
router.get("/accept-invite", (req, res) => {
  try {
    // Get token from query params
    const { token } = req.query;

    if (!isValidToken(token)) {
      return res.status(400).json({ error: "Invalid token" });
    }

    // Get frontend URL from env or use default
    const frontendUrl = "https://portal.saintlaurence.org.uk";
    // "https://togatherinv1.vercel.app" || "https://localhost:5173";
    const redirectUrl = `${frontendUrl}/accept-invite?token=${encodeURIComponent(
      token
    )}`;

    return res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error handling invite redirect:", error);
    return res.status(500).json({ error: "Failed to process invitation" });
  }
});

router.post("/accept-invite", validateAcceptInvite, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }
    const result = await acceptInvite(token);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error accepting invite:", error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

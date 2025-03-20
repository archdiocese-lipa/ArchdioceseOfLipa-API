const express = require("express");
const router = express.Router();
const { createInvite } = require("../services/inviteService");
const rateLimit = require("express-rate-limit");
const validateInvite = require("../middleware/validateInvite");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

const getUserId = (req) => {
  console.log("Getting user ID from:", req.user);
  if (!req.user || !req.user.id) {
    throw new Error("User ID not found");
  }
  return req.user.id;
};

const getUserName = (req) => {
  console.log("Getting user name from:", req.user);
  if (!req.body.inviterName) {
    throw new Error("Name not found");
  }
  return req.body.inviterName;
};

const getUserEmail = (req) => {
  console.log("Getting user email from:", req.user);
  if (!req.user || !req.user.email) {
    throw new Error("User email not found");
  }
  return req.user.email;
};

router.post("/send-invite", limiter, validateInvite, async (req, res) => {
  try {
    const originEmail = req.body.email;
    const { inviterName } = req.body;
    const inviterId = getUserId(req);
    const inviterEmail = getUserEmail(req);
    console.log(originEmail);

    // Check if email is the same as inviter
    if (originEmail === inviterEmail) {
      return res.status(400).json({ error: "Cannot invite yourself" });
    }

    const result = await createInvite(
      originEmail,
      inviterId,
      inviterEmail,
      inviterName
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in /send-invite route:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

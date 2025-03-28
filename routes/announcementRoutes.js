const express = require("express");
const router = express.Router();
const { createAnnouncements } = require("../services/announcementService");
const multer = require("multer");
const authMiddleware = require("../middleware/auth");
const { createClient } = require("@supabase/supabase-js");

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * @route POST /api/announcements
 * @desc Create a new announcement and notify users via email
 * @access Private
 */
router.post("/", authMiddleware, upload.array("files"), async (req, res) => {
  try {
    const { title, content } = req.body;
    const groupId = req.body.groupId || null;

    // Access user ID from authenticated user
    const userId = req.user.id;

    // Process uploaded files
    const files = req.files
      ? req.files.map((file) => {
          // Create a File-like object from the multer file
          const fileObj = {
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
          };

          // Add buffer as arrayBuffer() method to match File interface
          fileObj.arrayBuffer = () => Promise.resolve(file.buffer);

          // Add stream method for Supabase upload
          fileObj.stream = () => {
            const { Readable } = require("stream");
            return Readable.from(file.buffer);
          };

          return fileObj;
        })
      : [];

    const data = {
      title,
      content,
      files,
    };

    const announcement = await createAnnouncements({
      data,
      userId,
      groupId,
    });

    res.status(201).json({
      success: true,
      data: announcement,
      message: "Announcement created successfully",
    });
  } catch (error) {
    console.error("Error creating announcement:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create announcement",
      error: error.message,
    });
  }
});

/**
 * @route POST /api/announcements/group/:groupId
 * @desc Create a new announcement for a specific group
 * @access Private
 */
router.post(
  "/group/:groupId",
  authMiddleware,
  upload.array("files"),
  async (req, res) => {
    try {
      const { title, content } = req.body;
      const groupId = req.params.groupId;
      const userId = req.user.id;

      // Optional: Check if user is a member of the group
      const { data: membership, error: membershipError } = await supabase
        .from("group_members")
        .select("*")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .single();

      if (membershipError || !membership) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to post announcements in this group",
        });
      }

      // Process uploaded files
      const files = req.files
        ? req.files.map((file) => {
            const fileObj = {
              name: file.originalname,
              type: file.mimetype,
              size: file.size,
            };

            fileObj.arrayBuffer = () => Promise.resolve(file.buffer);

            fileObj.stream = () => {
              const { Readable } = require("stream");
              return Readable.from(file.buffer);
            };

            return fileObj;
          })
        : [];

      const data = {
        title,
        content,
        files,
      };

      const announcement = await createAnnouncements({
        data,
        userId,
        groupId,
      });

      res.status(201).json({
        success: true,
        data: announcement,
        message: "Group announcement created successfully",
      });
    } catch (error) {
      console.error("Error creating group announcement:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create group announcement",
        error: error.message,
      });
    }
  }
);

/**
 * @route GET /api/announcements
 * @desc Get all public announcements
 * @access Public
 */
router.get("/", async (req, res) => {
  try {
    const { data: announcements, error } = await supabase
      .from("announcement")
      .select(
        `
        *,
        announcement_files(*),
        users:user_id(name, email)
      `
      )
      .eq("visibility", "public")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: announcements,
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
      error: error.message,
    });
  }
});

module.exports = router;

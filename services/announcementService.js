const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");
require("dotenv").config();

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Resend setup
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Creates a new announcement and sends email notifications to users who have enabled them
 * @param {Object} params - Parameters
 * @param {Object} params.data - Announcement data
 * @param {string} params.userId - ID of the user creating the announcement
 * @param {string|null} params.groupId - Optional group ID for private announcements
 * @returns {Promise<Object>} The created announcement data
 */
const createAnnouncements = async ({ data, userId, groupId }) => {
  const fileData = [];

  // Upload files if any
  if (data.files && data.files.length > 0) {
    await Promise.all(
      data.files.map(async (file) => {
        const fileName = `${file.originalname.split(".")[0]}-${Date.now()}`;
        const fileExt = file.originalname.split(".")[1];

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("Uroboros")
          .upload(`announcement/${fileName}.png`, file.buffer, {
            contentType: file.mimetype,
          });

        if (uploadError) {
          throw new Error(`Error uploading file: ${uploadError.message}`);
        }

        fileData.push({
          url: uploadData.path,
          name: fileName,
          type: file.mimetype,
        });
      })
    );
  }

  // Insert the announcement
  const { data: fetchData, error } = await supabase
    .from("announcement")
    .insert([
      {
        title: data.title,
        content: data.content,
        visibility: groupId ? "private" : "public",
        group_id: groupId ?? null,
        user_id: userId,
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("Error inserting announcement:", error.message);
    throw error;
  }

  // Insert files related to the announcement if any
  if (fileData.length > 0) {
    await Promise.all(
      fileData.map(async (file) => {
        const { error: insertError } = await supabase
          .from("announcement_files")
          .insert([{ announcement_id: fetchData.id, ...file }]);

        if (insertError) {
          console.error(
            "Error inserting into announcement_files:",
            insertError
          );
          throw insertError;
        }
      })
    );
  }

  // Send email notifications to users who enabled them
  try {
    await sendAnnouncementEmailToUsers(
      data.title,
      data.content,
      fileData,
      groupId
    );
  } catch (emailError) {
    console.error("Error sending announcement emails:", emailError);
    // Continue with the announcement creation even if emails fail
  }

  return fetchData;
};

/**
 * Send announcement emails to users who have enabled email notifications
 * @param {string} title - The announcement title
 * @param {string} content - The announcement content
 * @param {Array} files - Files associated with the announcement
 * @param {string|null} groupId - The group ID if it's a group announcement
 */
async function sendAnnouncementEmailToUsers(
  title,
  content,
  files = [],
  groupId
) {
  // Query users who have email notifications enabled
  let query = supabase
    .from("users")
    .select("email")
    .eq("email_notifications_enabled", true);

  // If group-specific announcement, only notify that group's members
  if (groupId) {
    const { data: groupMembers, error: groupError } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (groupError) {
      console.error("Error fetching group members:", groupError);
      return;
    }

    if (groupMembers && groupMembers.length > 0) {
      const memberIds = groupMembers.map((member) => member.user_id);
      query = query.in("id", memberIds);
    } else {
      // No group members to notify
      return;
    }
  }

  const { data: users, error } = await query;

  if (error) {
    console.error("Error fetching users for email notifications:", error);
    return;
  }

  if (!users || users.length === 0) {
    console.log("No users to notify");
    return;
  }

  // Create HTML for the email
  const htmlContent = createEmailHtml(title, content, files);

  // Send emails to all users
  await Promise.all(
    users.map(async (user) => {
      try {
        await resend.emails.send({
          from: "On behalf of the Archdiocese of Lipa <archdioceseoflipa@togather.app>",
          to: user.email,
          subject: title,
          html: htmlContent,
        });
        console.log(`Email sent to ${user.email}`);
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
      }
    })
  );
}

/**
 * Create HTML content for the announcement email
 * @param {string} title - The announcement title
 * @param {string} content - The announcement content
 * @param {Array} files - Files associated with the announcement
 * @returns {string} HTML content for the email
 */
function createEmailHtml(title, content, files) {
  // Get image files
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));

  // Generate HTML for images if there are any
  let imagesHtml = "";
  if (imageFiles.length > 0) {
    imagesHtml = '<div style="margin-top: 20px;">';
    imageFiles.forEach((file) => {
      const publicUrl = supabase.storage.from("Uroboros").getPublicUrl(file.url)
        .data.publicUrl;
      imagesHtml += `<img src="${publicUrl}" alt="${file.name}" style="max-width: 100%; margin-bottom: 10px; border-radius: 4px;">`;
    });
    imagesHtml += "</div>";
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; margin-bottom: 20px;">${title}</h1>
      <div style="color: #555; line-height: 1.6;">
        ${content}
      </div>
      ${imagesHtml}
      <p style="margin-top: 30px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 15px;">
        This is an automated message from the Archdiocese of Lipa.
      </p>
    </div>
  `;
}

module.exports = { createAnnouncements };

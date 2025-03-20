const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");
const crypto = require("crypto");
require("dotenv").config();

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Function to send the invitation email
const sendInviteEmail = async (email, token, inviterName) => {
  const URL = process.env.FRONTEND_URL;
  // "https://togatherinv1.vercel.app" ||
  // "https://localhost:5173";
  const invitationLink = `${URL}/accept-invite?token=${token}`;

  try {
    const response = await resend.emails.send({
      from: "noreply@portal.saintlaurence.org.uk",
      to: email,
      subject: "Invite",
      html: `<p>You have been invited to join <strong>${inviterName}</strong>'s family account. Click the link below to accept the invitation:</p>
             <a href="${invitationLink}">${invitationLink}</a>`,
    });

    // Check the response to ensure it was successful
    if (response.error === null) {
      console.log("Email sent successfully, ID:", response?.data.id);
    } else {
      console.error("Failed to send email:", response?.error);
      throw new Error("Failed to send email");
    }
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

// Function to create invite and send email
const createInvite = async (email, inviterId, inviterEmail, inviterName) => {
  const token = crypto.randomBytes(32).toString("hex");

  const originEmail = email;

  // Send invite email
  await sendInviteEmail(email, token, inviterName);

  // Save the invite details in the invites table
  const { data, error } = await supabase.from("family_invitations").insert([
    {
      email: originEmail,
      token,
      inviter_id: inviterId,
      inviter_email: inviterEmail,
    },
  ]);

  if (error) {
    console.error("Error inserting invite into Supabase:", error);
    throw new Error("Error inserting invite into Supabase");
  } else {
    console.log("Invite inserted successfully:", data);
  }
};
// Function to accept the invitation
const acceptInvite = async (token) => {
  //Find the invite by token
  const { data: invite, error: inviteError } = await supabase
    .from("family_invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    throw new Error("Invalid or expired invitation token");
  }

  // Check if invite is already accepted
  if (invite.accepted) {
    throw new Error("Invitation has already been accepted");
  }

  // Get the inviter's family_id
  const { data: inviter, error: inviterError } = await supabase
    .from("parents")
    .select("family_id")
    .eq("parishioner_id", invite?.inviter_id)
    .single();

  if (inviterError || !inviter) {
    throw new Error("Inviter not found");
  }

  // Select the id of the invitee by email
  const { data: userEmail, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", invite?.email)
    .single();

  if (error) {
    throw new Error("Error finding user by email");
  }

  // Update the invitee's family_id
  const { error: updateError } = await supabase
    .from("parents")
    .update({ family_id: inviter.family_id })
    .eq("parishioner_id", userEmail.id);

  if (updateError) {
    throw new Error("Failed to update family id");
  }
  // Mark the invite as accepted
  const { error: acceptError } = await supabase
    .from("family_invitations")
    .update({ accepted: true })
    .eq("id", invite.id);

  if (acceptError) {
    throw new Error("Failed to mark invitation as accepted");
  }
  // Delete the invited user from family_grou

  const { error: deleteError } = await supabase
    .from("family_group")
    .delete()
    .eq("user_id", userEmail.id);
  if (deleteError) {
    throw new Error("Failed to delete user from family_group");
  }
  return { message: "Invitation accepted successfully" };
};

module.exports = { createInvite, acceptInvite };

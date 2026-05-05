// controller/authController.js
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const pool = require('../models/db');
const crypto = require('crypto');
const dayjs = require('dayjs');
const emailTemplate = require('../utils/emailTemplate');

const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = process.env.BASE_URL;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,                        
  hospital_id: user.hospital_id,
  organization_id: user.organization_id,
  is_verified: user.is_verified,
  is_approved: user.is_approved,
  has_global_access: user.has_global_access,
  timezone: user.timezone, 
});


const buildTokenPayload = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,                         
  hospital_id: user.hospital_id,
  organization_id: user.organization_id,
  is_approved: user.is_approved,
  has_global_access: user.has_global_access,
  timezone: user.timezone,  
});


const signup = async (req, res) => {
  const { name, email, password, role, organization_id, hospital_id } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'Missing required fields' });

  if (!['super_admin', 'admin', 'staff'].includes(role))
    return res.status(400).json({ error: 'Invalid role. Must be super_admin, admin, or staff' });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    let finalOrgId = organization_id || null;
    let finalHospitalId = hospital_id || null;

    if (role === 'super_admin') {
      if (!organization_id)
        return res.status(400).json({ error: 'organization_id is required for super_admin' });

      // Super admins are not tied to a hospital
      finalHospitalId = null;

    } else {
      // admin and staff must belong to a hospital
      if (!hospital_id)
        return res.status(400).json({ error: 'hospital_id is required for admin and staff' });

      const h = await pool.query(
        'SELECT organization_id FROM hospitals WHERE id = $1',
        [hospital_id]
      );
      if (h.rowCount === 0)
        return res.status(400).json({ error: 'Invalid hospital_id' });

      // Always derive org from hospital — don't trust client-sent org_id
      finalOrgId = h.rows[0].organization_id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // FIX: INSERT uses role column, not 3 boolean columns
    const result = await pool.query(
      `INSERT INTO users
        (name, email, password, role, has_global_access, organization_id, hospital_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, organization_id, hospital_id,
                 is_verified, is_approved, has_global_access`,
      [
        name,
        normalizedEmail,
        hashedPassword,
        role,
        false, 
        finalOrgId,
        finalHospitalId,
      ]
    );

    const user = result.rows[0];

    // Verification token reuses JWT — short lived, only for email confirmation
    const verifyToken = jwt.sign(buildTokenPayload(user), JWT_SECRET, { expiresIn: '1d' });
    const verifyUrl = `${BASE_URL}/auth/verify?token=${verifyToken}`;

      await transporter.sendMail({
      from: `"Pace The Case" <${process.env.EMAIL_USERNAME}>`,
      to: normalizedEmail,
      subject: 'Confirm Your Email for Pace The Case',
      html: emailTemplate(
        `<p>Hi <strong>${name}</strong>,</p>
        <p>Thank you for signing up for <strong>Pace The Case</strong>!</p>
        <p>Please verify your email address by clicking the button below.</p>
        <p style="padding:14px 18px;background:#f4f7fb;border-left:4px solid #1B3A5C;border-radius:4px;">
          🔒 <strong>Note:</strong> After verifying, your account still needs 
          <strong>administrator approval</strong> before you can sign in.
        </p>`,
        "Verify My Email",
        verifyUrl
      ),
    });
    res.status(201).json({
      message: 'Signup successful! Check your email to verify.',
      user: safeUser(user),
    });
  } catch (err) {
    console.error('Signup error:', err);
    if (err.code === '23505')
      return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Signup failed' });
  }
};

const verify = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Missing token.');

    const decoded = jwt.verify(token, JWT_SECRET);

    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [decoded.id]);

    // Fetch verified user details
    const { rows: [user] } = await pool.query(
      `SELECT id, name, email, role, hospital_id, organization_id FROM users WHERE id = $1`,
      [decoded.id]
    );

    // Notify admins now that email is verified and needs approval
    const { rows: admins } = await pool.query(
      `SELECT id FROM users
       WHERE is_approved = TRUE
         AND (
           (role = 'admin'       AND hospital_id     = $1)
           OR
           (role = 'super_admin' AND organization_id = $2)
         )`,
      [user.hospital_id, user.organization_id]
    );

    const io = req.app.get("io");
    for (const admin of admins) {
      const { rows: [notif] } = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'approval_request') RETURNING *`,
        [
          admin.id,
          "New User Pending Approval",
          `${user.name} (${user.email}) has verified their email as ${user.role} and is awaiting your approval.`,
        ]
      );
      io?.to?.(`user-${admin.id}`)?.emit("notification", notif);
    }

    res.send('Email verified. Your account is now pending administrator approval.');

  } catch (err) {
    console.error('Verify error:', err);
    res.status(400).send('Invalid or expired token.');
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { password } = req.body;
  if (!req.body.email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const email = req.body.email.toLowerCase().trim();

  try {
    // FIX: SELECT includes role, not the 3 boolean columns
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.password, u.role, u.hospital_id, u.organization_id,
                u.is_verified, u.is_approved, u.has_global_access,
                CASE
                  WHEN u.role = 'administration' THEN 'America/New_York'
                  WHEN u.role = 'super_admin' THEN o.timezone
                  ELSE h.timezone
                END AS timezone
        FROM users u
        LEFT JOIN hospitals     h ON h.id = u.hospital_id
        LEFT JOIN organizations o ON o.id = u.organization_id
        WHERE u.email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (!user)
      return res.status(400).json({ error: 'User not found' });
    if (!user.is_verified)
      return res.status(403).json({ error: 'Email not verified' });
    if (!user.is_approved)
      return res.status(403).json({ error: 'Your account is pending approval by admin.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Incorrect password' });

    const token = jwt.sign(buildTokenPayload(user), JWT_SECRET, { expiresIn: '24h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful',
      user: safeUser(user),
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });
  res.json({ message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  try {
    const { id } = req.user;
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.hospital_id, u.organization_id,
              u.is_verified, u.is_approved, u.has_global_access,
              CASE
                WHEN u.role = 'administration' THEN 'America/New_York'
                WHEN u.role = 'super_admin' THEN o.timezone
                ELSE h.timezone
              END AS timezone 
       FROM users u
       LEFT JOIN hospitals     h ON h.id = u.hospital_id
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [id]
    );

    if (!result.rows.length)
      return res.status(401).json({ error: "Not authenticated" });

    res.json({ user: safeUser(result.rows[0]) });

  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ error: "Failed to fetch user info" });
  }
};
// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const userRes = await pool.query('SELECT id, name FROM users WHERE email = $1', [normalizedEmail]);

    // Always return 200 to prevent email enumeration
    if (userRes.rowCount === 0)
      return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const user = userRes.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = dayjs().add(1, 'hour').toISOString();

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [token, expires, user.id]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}&email=${normalizedEmail}`;

    await transporter.sendMail({
      from: `"Pace The Case" <${process.env.EMAIL_USERNAME}>`,
      to: normalizedEmail,
      subject: 'Password Reset Request – Pace The Case',
      html: emailTemplate(
        `<p>Hello <strong>${user.name}</strong>,</p>
        <p>We received a request to reset your <strong>Pace The Case</strong> password.</p>
        <p>This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.</p>`,
        "Reset My Password",
        resetLink
      ),
    });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword)
    return res.status(400).json({ error: 'Email, token, and new password are required' });

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const userRes = await pool.query(
      'SELECT id, reset_token, reset_token_expires FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = userRes.rows[0];

    if (!user || !user.reset_token || !user.reset_token_expires)
      return res.status(400).json({ error: 'Invalid or expired reset link' });

    if (user.reset_token !== token || dayjs().isAfter(dayjs(user.reset_token_expires)))
      return res.status(400).json({ error: 'Invalid or expired reset token' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

module.exports = { signup, verify, login, logout, getMe, forgotPassword, resetPassword };
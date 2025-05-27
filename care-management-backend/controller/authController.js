// controller/authController.js
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const pool = require('../models/db');
const crypto = require('crypto');
const dayjs = require("dayjs");

const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = process.env.BASE_URL;

// Email setup using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// SIGNUP
const signup = async (req, res) => {
    const { name, password, isAdmin, isStaff } = req.body;
    const email = req.body.email.toLowerCase();
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const result = await pool.query(
        `INSERT INTO users (name, email, password, is_admin, is_staff, is_verified)
         VALUES ($1, $2, $3, $4, $5, false) RETURNING id, email, name, is_admin, is_staff, is_verified`,
        [name,  email.toLowerCase(), hashedPassword, isAdmin, isStaff]
      );
  
      const token = jwt.sign({ userId: result.rows[0].id }, JWT_SECRET, { expiresIn: '1d' });
      const verifyUrl = `${BASE_URL}/auth/verify?token=${token}`;
  
      await transporter.sendMail({
        from: `"Care Management" <${process.env.EMAIL_USERNAME}>`,
        to: email,
        subject: "Verify Your Email",
        html: `<p>Hello ${name},</p><p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`,
      });
  
      // Return user data along with the token
      res.status(201).json({
        message: 'User created. Check your email to verify.',
        token: token,
        user: {
          id: result.rows[0].id,
          email: result.rows[0].email,
          name: result.rows[0].name,
          is_admin: result.rows[0].is_admin,
          is_staff: result.rows[0].is_staff,
          is_verified: result.rows[0].is_verified,
        },
      });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        // This handles duplicate email
        return res.status(400).json({ error: 'Email already exists' });
      }
      res.status(500).json({ error: 'Signup failed' });
    }
  };
  

// VERIFY
const verify = async (req, res) => {
  try {
    const { token } = req.query;
    const decoded = jwt.verify(token, JWT_SECRET);
    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [decoded.userId]);
    res.send('Email verified. You can now log in.');
  } catch (err) {
    console.error(err);
    res.status(400).send('Invalid or expired token.');
  }
};

// LOGIN
const login = async (req, res) => {
    const { password } = req.body;
    const email = req.body.email.toLowerCase();
    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
  
      if (!user) return res.status(400).json({ error: 'User not found' });
      if (!user.is_verified) return res.status(403).json({ error: 'Email not verified' });
  
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: 'Incorrect password' });
  
      const token = jwt.sign(
        {
          id: user.id,
          is_admin: user.is_admin,
          is_staff: user.is_staff,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
  
      // ✅ Set the token as httpOnly cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      });
      
  
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          is_admin: user.is_admin,
          is_staff: user.is_staff,
          is_verified: user.is_verified,
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  };
  const logout = (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });
    res.json({ message: "Logged out successfully" });
  };

  const getMe = async (req, res) => {
    try {
      const { id } = req.user;
      const result = await pool.query(
        'SELECT id, name, email, is_admin, is_staff, is_verified FROM users WHERE id = $1',
        [id]
      );
  
      if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
      res.json({ user: result.rows[0] });
    } catch (err) {
      console.error('Error fetching current user:', err);
      res.status(500).json({ error: 'Failed to fetch user info' });
    }
  };
  const forgotPassword = async (req, res) => {
    const { email } = req.body;
  
    if (!email) return res.status(400).json({ error: "Email is required" });
  
    try {
      const normalizedEmail = email.toLowerCase();
  
      const userRes = await pool.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
      if (userRes.rowCount === 0) {
        return res.status(404).json({ error: "No user with that email found." });
      } 
      const user = userRes.rows[0];
      const name = user.name;
  
      const token = crypto.randomBytes(32).toString("hex");
      const expires = dayjs().add(1, "hour").toISOString();
  
      await pool.query(
        "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3",
        [token, expires, normalizedEmail]
      );
  
      const resetLink = `https://www.pacethecase.com/reset-password?token=${token}&email=${normalizedEmail}`;
      console.log(`📨 Password reset link: ${resetLink}`);
      await transporter.sendMail({
        from: `"Care Management" <${process.env.EMAIL_USERNAME}>`,
        to: normalizedEmail,
        subject: "You requested a password reset",
        html: `<p>Hello ${name},</p><p><a href="${resetLink}">Click here to reset your password.</a></p><p>This link will expire in 1 hour.</p>`,
      });
      
  
      res.json({ message: "Password reset link sent. Check your email (or console)." });
    } catch (err) {
      console.error("❌ Forgot Password Error:", err.message, err.stack);
      res.status(500).json({ error: "Internal server error during password reset request" });
    }
  };
  
  const resetPassword = async (req, res) => {
    const { email, token, newPassword } = req.body;
  
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token, and new password are required' });
    }
  
    try {
      const normalizedEmail = email.toLowerCase();
  
      const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
      const user = userRes.rows[0];
  
      if (!user || !user.reset_token || !user.reset_token_expires) {
        return res.status(400).json({ error: 'Invalid reset link or expired token' });
      }
  
      if (
        user.reset_token !== token ||
        dayjs().isAfter(dayjs(user.reset_token_expires))
      ) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
  
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      await pool.query(
        'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE email = $2',
        [hashedPassword, normalizedEmail]
      );
  
      res.json({ message: 'Password has been reset successfully' });
    } catch (err) {
      console.error('Error in resetPassword:', err);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  };

module.exports = {
  signup,
  verify,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword

};

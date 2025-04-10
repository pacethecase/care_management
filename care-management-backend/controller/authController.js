// controller/authController.js
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const pool = require('../models/db');

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
    const { name, email, password, isAdmin, isStaff } = req.body;
  
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const result = await pool.query(
        `INSERT INTO users (name, email, password, is_admin, is_staff, is_verified)
         VALUES ($1, $2, $3, $4, $5, false) RETURNING id, email, name, is_admin, is_staff, is_verified`,
        [name, email, hashedPassword, isAdmin, isStaff]
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
    const { email, password } = req.body;
  
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
        secure: false, // ⚠️ Set true in production
        sameSite: "Lax", // or "Strict"
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
    res.clearCookie("token");
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
  
module.exports = {
  signup,
  verify,
  login,
  logout,
  getMe
};

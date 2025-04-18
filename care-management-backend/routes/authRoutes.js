const express = require("express");
const { signup, login, verify, logout,getMe,forgotPassword,resetPassword} = require("../controller/authController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/verify", verify); // ✅ Token now verified here too
router.post("/logout", logout);
router.get('/me', verifyToken, getMe);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
module.exports = router;

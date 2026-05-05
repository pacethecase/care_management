const express = require("express");
const router  = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { signup, login, verify, logout, getMe, forgotPassword, resetPassword } = require("../controller/authController");
 
router.post("/signup",         signup);
router.post("/login",          login);
router.get("/verify",          verify);
router.post("/logout",         logout);
router.get("/me",   verifyToken, getMe);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password",  resetPassword);
 
module.exports = router;
const express = require("express");
const router  = express.Router();
const { getPublicHospitals, getPublicOrganizations } = require("../controller/publicController");
 
router.get("/hospitals",     getPublicHospitals);
router.get("/organizations", getPublicOrganizations);
 
module.exports = router;
 
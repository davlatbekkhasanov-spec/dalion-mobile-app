const express = require('express');
const router = express.Router();

const homeController = require('../controllers/home.controller.js');

router.get('/home', homeController.getHome);

module.exports = router;

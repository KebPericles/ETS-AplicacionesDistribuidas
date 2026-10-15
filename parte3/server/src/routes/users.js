const express = require('express');
const controller = require('../controllers/userController');

const router = express.Router();

router.get('/', controller.list);
router.patch('/:id', controller.update);

module.exports = router;

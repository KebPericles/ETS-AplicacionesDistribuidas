const express = require('express');
const controller = require('../controllers/ticketController');
const commentController = require('../controllers/commentController');
const assignmentController = require('../controllers/assignmentController');
const statsController = require('../controllers/statsController');
const { requireRoles } = require('../middleware/authenticate');

const router = express.Router();

router.get('/', controller.list);
router.get('/stats', requireRoles('agente', 'admin'), statsController.getStats);
router.post('/', requireRoles('cliente', 'admin'), controller.create);
router.get('/:id/comentarios', commentController.list);
router.post('/:id/comentarios', commentController.add);
router.patch('/:id/asignar', requireRoles('agente', 'admin'), assignmentController.assign);
router.get('/:id', controller.getOne);
router.patch('/:id/estado', controller.changeStatus);

module.exports = router;

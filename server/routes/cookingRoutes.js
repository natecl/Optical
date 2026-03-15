const express = require('express');
const {
  postCreateSession,
  getSessionById,
  postSessionEvent
} = require('../controllers/cookingController');

const router = express.Router();

router.post('/cooking/sessions', postCreateSession);
router.get('/cooking/sessions/:sessionId', getSessionById);
router.post('/cooking/sessions/:sessionId/events', postSessionEvent);

module.exports = router;

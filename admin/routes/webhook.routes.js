const express = require("express");

const router = express.Router();

let bot;

function setBotInstance(botInstance) {
  bot = botInstance;
}

// ShegerPay webhook handler
router.post('/', (req, res) => {
  // Handle ShegerPay webhook
  // Add your webhook logic here
  console.log('ShegerPay webhook received', req.body);
  res.status(200).send('OK');
});

module.exports = { router, setBotInstance };
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = 'https://coin-shop-hub-production.up.railway.app/callback';

// Twitch API credentials
const TWITCH_CLIENT_ID = process.env.CLIENT_ID; // Same as Discord CLIENT_ID for this bot
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN; // You'll need to set this
const TWITCH_BROADCASTER_ID = '117580'; // Your Twitch user ID
const WEBHOOK_CALLBACK_URL = 'https://shop-bot-production-a805.up.railway.app/api/live-webhook';
const WEBHOOK_SECRET = 'mysecret123';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── Discord OAuth2 Callback ───────────────────────────────────────────────────
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/');

  try {
    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();

    // Get user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    // Redirect to home with user info as query params
    res.redirect(`/?username=${encodeURIComponent(user.username)}&id=${user.id}&avatar=${user.avatar}`);
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect('/');
  }
});

// ─── API: Get user balance ─────────────────────────────────────────────────────
app.get('/api/balance/:userId', (req, res) => {
  try {
    const { db } = require('./bot');
    const row = db.prepare('SELECT balance FROM user_balances WHERE user_id = ?').get(req.params.userId);
    res.json({ balance: row ? row.balance : 0 });
  } catch {
    res.json({ balance: 0 });
  }
});

// ─── API: Setup Twitch Live Notification Webhook ────────────────────────────────
app.post('/api/setup-twitch-webhook', async (req, res) => {
  try {
    // Check if token is available
    if (!TWITCH_ACCESS_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: 'TWITCH_ACCESS_TOKEN is not set in environment variables',
      });
    }

    console.log('[Twitch Webhook] Setting up stream.online subscription...');

    const payload = {
      type: 'stream.online',
      version: '1',
      condition: {
        broadcaster_user_id: TWITCH_BROADCASTER_ID,
      },
      transport: {
        method: 'webhook',
        callback: WEBHOOK_CALLBACK_URL,
        secret: WEBHOOK_SECRET,
      },
    };

    const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TWITCH_ACCESS_TOKEN}`,
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Twitch Webhook] Error response:', data);
      return res.status(response.status).json({
        ok: false,
        error: data.message || 'Failed to set up Twitch webhook',
        details: data,
      });
    }

    console.log('[Twitch Webhook] Success! Subscription created:', data);

    res.json({
      ok: true,
      message: 'Twitch webhook set up successfully!',
      subscription: data.data?.[0] || null,
    });
  } catch (err) {
    console.error('[Twitch Webhook] Setup error:', err);
    res.status(500).json({
      ok: false,
      error: err.message || 'An error occurred while setting up the webhook',
    });
  }
});

app.listen(PORT, () => console.log(`🌐 Website running on port ${PORT}`));

module.exports = app;


const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = 'https://coin-shop-hub-production.up.railway.app/callback';

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

app.listen(PORT, () => console.log(`🌐 Website running on port ${PORT}`));

module.exports = app;

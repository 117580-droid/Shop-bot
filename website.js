/** @jsx jsx */
/** @jsxImportSource hono/jsx */
import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';

const app = new Hono();

const ADMIN_ID = '1323477103877820428';
const DISCORD_CLIENT_ID = '1507670215801049149';

// In-memory storage
let shopItems = [
  { id: 1, name: '1 ENTRY FOR MONTHLY WHEEL', points: 3 },
  { id: 2, name: 'PICK ANY CUSTOM GAME YOU WANT', points: 5 },
];

let users = new Map();
let nextItemId = 3;

// Mock user data
const mockUsers = {
  'user123': { id: 'user123', discordUsername: 'TestUser', twitchUsername: null, points: 100, authType: 'discord' },
};

app.get('/', (c) => {
  const session = getCookie(c, 'session');
  const user = session ? mockUsers[session] : null;

  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>⭐ Points Shop</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
        }

        header {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 30px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        h1 {
          color: #333;
          font-size: 1.8em;
        }

        .auth-section {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .user-info {
          background: #f5f5f5;
          padding: 10px 15px;
          border-radius: 8px;
          color: #333;
          font-weight: 500;
        }

        .points-display {
          background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
          color: #333;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 1.1em;
        }

        button {
          background: #667eea;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        button:hover {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .login-buttons {
          display: flex;
          gap: 10px;
        }

        .discord-btn {
          background: #5865F2;
        }

        .discord-btn:hover {
          background: #4752C4;
        }

        .twitch-btn {
          background: #9146FF;
        }

        .twitch-btn:hover {
          background: #772CE8;
        }

        .content {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 30px;
        }

        .shop-section, .admin-section {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        }

        h2 {
          color: #333;
          margin-bottom: 20px;
          font-size: 1.5em;
        }

        .shop-items {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 15px;
        }

        .shop-item {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }

        .shop-item:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
          border-color: white;
        }

        .item-name {
          font-weight: 600;
          margin-bottom: 10px;
          font-size: 0.95em;
        }

        .item-price {
          font-size: 1.3em;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .buy-btn {
          background: white;
          color: #667eea;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          width: 100%;
          cursor: pointer;
          border: none;
          transition: all 0.3s ease;
        }

        .buy-btn:hover {
          background: #f0f0f0;
          transform: scale(1.05);
        }

        .admin-section {
          background: #fff9e6;
          border-left: 4px solid #FFD700;
        }

        .admin-section h3 {
          color: #FF6B6B;
          margin-bottom: 15px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        label {
          display: block;
          color: #333;
          font-weight: 600;
          margin-bottom: 5px;
          font-size: 0.9em;
        }

        input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.9em;
        }

        .admin-btn {
          width: 100%;
          background: #FF6B6B;
          margin-bottom: 10px;
        }

        .admin-btn:hover {
          background: #FF5252;
        }

        .item-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: white;
          border-radius: 6px;
          margin-bottom: 8px;
          font-size: 0.9em;
        }

        .delete-btn {
          background: #FF6B6B;
          padding: 4px 8px;
          font-size: 0.8em;
        }

        .alert {
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: none;
        }

        .alert.show {
          display: block;
        }

        .alert.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .alert.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .profile-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        }

        .profile-card h3 {
          color: #333;
          margin-bottom: 15px;
        }

        .profile-stat {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
          color: #666;
        }

        .profile-stat:last-child {
          border-bottom: none;
        }

        @media (max-width: 768px) {
          .content {
            grid-template-columns: 1fr;
          }

          .shop-items {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          }

          header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>⭐ Points Shop</h1>
          <div class="auth-section">
            ${user ? \`
              <div class="user-info">👤 \${user.twitchUsername || user.discordUsername}</div>
              <div class="points-display">⭐ \${user.points} Points</div>
              <button onclick="logout()">Logout</button>
            \` : \`
              <div class="login-buttons">
                <button class="discord-btn" onclick="loginDiscord()">Discord Login</button>
                <button class="twitch-btn" onclick="loginTwitch()">Twitch Login</button>
              </div>
            \`}
          </div>
        </header>

        <div id="alert" class="alert"></div>

        ${user ? \`
          <div class="content">
            <div class="shop-section">
              <h2>🛍️ Shop Items</h2>
              <div class="shop-items" id="shopItems"></div>
            </div>

            <div class="sidebar">
              <div class="profile-card">
                <h3>📊 Your Stats</h3>
                <div class="profile-stat">
                  <span>Points Balance:</span>
                  <strong>\${user.points}</strong>
                </div>
                <div class="profile-stat">
                  <span>Auth Type:</span>
                  <strong>\${user.authType === 'twitch' ? 'Twitch' : 'Discord'}</strong>
                </div>
              </div>

              ${user.id === ADMIN_ID ? \`
                <div class="admin-section">
                  <h3>⚙️ Admin Panel</h3>
                  <div class="form-group">
                    <label>Item Name</label>
                    <input type="text" id="itemName" placeholder="e.g., Custom Game">
                  </div>
                  <div class="form-group">
                    <label>Points Cost</label>
                    <input type="number" id="itemPoints" placeholder="e.g., 5" min="1">
                  </div>
                  <button class="admin-btn" onclick="addItem()">➕ Add Item</button>

                  <h3 style="margin-top: 20px; margin-bottom: 10px;">Items</h3>
                  <div class="item-list" id="itemList"></div>
                </div>
              \` : ''}
            </div>
          </div>
        \` : \`
          <div style="background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);">
            <h2 style="color: #333; margin-bottom: 20px;">Welcome to the Points Shop!</h2>
            <p style="color: #666; margin-bottom: 30px; font-size: 1.1em;">Sign in with Discord or Twitch to get started</p>
            <div style="display: flex; gap: 15px; justify-content: center;">
              <button class="discord-btn" style="padding: 15px 30px; font-size: 1.1em;" onclick="loginDiscord()">🔵 Discord Login</button>
              <button class="twitch-btn" style="padding: 15px 30px; font-size: 1.1em;" onclick="loginTwitch()">💜 Twitch Login</button>
            </div>
          </div>
        \`}
      </div>

      <script>
        const shopItems = ${JSON.stringify(shopItems)};

        function renderShop() {
          const container = document.getElementById('shopItems');
          if (!container) return;
          
          container.innerHTML = shopItems.map(item => \`
            <div class="shop-item">
              <div class="item-name">\${item.name}</div>
              <div class="item-price">\${item.points} ⭐</div>
              <button class="buy-btn" onclick="buyItem(\${item.id})">Buy Now</button>
            </div>
          \`).join('');
        }

        function renderAdminItems() {
          const container = document.getElementById('itemList');
          if (!container) return;

          container.innerHTML = shopItems.map(item => \`
            <div class="item-row">
              <span>\${item.name} - \${item.points}⭐</span>
              <button class="delete-btn" onclick="deleteItem(\${item.id})">Delete</button>
            </div>
          \`).join('');
        }

        function buyItem(itemId) {
          const item = shopItems.find(i => i.id === itemId);
          if (!item) return;

          showAlert(\`✅ Purchased: \${item.name} for \${item.points} points!\`, 'success');
        }

        function addItem() {
          const name = document.getElementById('itemName').value;
          const points = parseInt(document.getElementById('itemPoints').value);

          if (!name || !points || points < 1) {
            showAlert('❌ Please fill in all fields correctly', 'error');
            return;
          }

          shopItems.push({ id: Date.now(), name, points });
          document.getElementById('itemName').value = '';
          document.getElementById('itemPoints').value = '';
          renderAdminItems();
          showAlert(\`✅ Item added: \${name}\`, 'success');
        }

        function deleteItem(itemId) {
          shopItems = shopItems.filter(i => i.id !== itemId);
          renderAdminItems();
          showAlert('✅ Item deleted', 'success');
        }

        function showAlert(message, type) {
          const alert = document.getElementById('alert');
          alert.textContent = message;
          alert.className = \`alert show \${type}\`;
          setTimeout(() => alert.classList.remove('show'), 3000);
        }

        function loginDiscord() {
          showAlert('🔵 Discord login would redirect to OAuth', 'success');
        }

        function loginTwitch() {
          showAlert('💜 Twitch login would redirect to OAuth', 'success');
        }

        function logout() {
          showAlert('👋 Logged out successfully', 'success');
          setTimeout(() => location.reload(), 1000);
        }

        // Initial render
        renderShop();
        renderAdminItems();
      </script>
    </body>
    </html>
  \`);
});

export default app;


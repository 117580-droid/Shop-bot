// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  // Remove active class from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(tabName).classList.add('active');

  // Add active class to clicked button
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// Discord Login
document.getElementById('discord-login').addEventListener('click', () => {
  const CLIENT_ID = '1507670215801049149';
  const REDIRECT_URI = encodeURIComponent('https://coin-shop-hub-production.up.railway.app/callback');
  const SCOPES = encodeURIComponent('identify');
  
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${SCOPES}`;
  window.location.href = authUrl;
});

// Load user data on page load
window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  const username = params.get('username');
  const userId = params.get('id');
  const avatar = params.get('avatar');

  if (username && userId) {
    // User is logged in
    loadUserProfile(username, userId, avatar);
    loadLeaderboard();
    loadShop();
    
    // Switch to profile tab
    switchTab('profile');
  } else {
    // User is not logged in
    showNotLoggedIn();
  }
});

function loadUserProfile(username, userId, avatar) {
  const profileContent = document.getElementById('profile-content');
  
  // Build avatar URL
  const avatarUrl = avatar 
    ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`
    : 'https://via.placeholder.com/120';

  // Fetch user balance
  fetch(`/api/balance/${userId}`)
    .then(res => res.json())
    .then(data => {
      const balance = data.balance || 0;
      
      profileContent.innerHTML = `
        <img src="${avatarUrl}" alt="${username}" class="profile-avatar" onerror="this.src='https://via.placeholder.com/120'">
        <div class="profile-username">${username}</div>
        <div class="profile-stats">
          <div class="stat">
            <div class="stat-label">Points</div>
            <div class="stat-value">${balance}</div>
          </div>
        </div>
      `;
    })
    .catch(err => {
      console.error('Error fetching balance:', err);
      profileContent.innerHTML = `
        <img src="${avatarUrl}" alt="${username}" class="profile-avatar" onerror="this.src='https://via.placeholder.com/120'">
        <div class="profile-username">${username}</div>
        <div class="profile-stats">
          <div class="stat">
            <div class="stat-label">Points</div>
            <div class="stat-value">0</div>
          </div>
        </div>
      `;
    });
}

function loadLeaderboard() {
  const leaderboardList = document.getElementById('leaderboard-list');
  
  // Placeholder leaderboard data
  // In a real app, this would come from your database
  const leaderboardData = [
    { rank: 1, username: 'Player1', points: 5000 },
    { rank: 2, username: 'Player2', points: 4500 },
    { rank: 3, username: 'Player3', points: 4000 },
    { rank: 4, username: 'Player4', points: 3500 },
    { rank: 5, username: 'Player5', points: 3000 },
  ];

  if (leaderboardData.length === 0) {
    leaderboardList.innerHTML = '<div class="leaderboard-empty">No leaderboard data available</div>';
    return;
  }

  leaderboardList.innerHTML = leaderboardData.map(entry => `
    <div class="leaderboard-item">
      <div class="leaderboard-rank">#${entry.rank}</div>
      <div class="leaderboard-username">${entry.username}</div>
      <div class="leaderboard-points">${entry.points} pts</div>
    </div>
  `).join('');
}

function loadShop() {
  const shopItems = document.getElementById('shop-items');
  
  // Placeholder shop items
  // In a real app, this would come from your database
  const shopData = [
    { id: 1, name: 'Badge', price: 100 },
    { id: 2, name: 'Title', price: 250 },
    { id: 3, name: 'Role', price: 500 },
    { id: 4, name: 'Custom Color', price: 750 },
  ];

  if (shopData.length === 0) {
    shopItems.innerHTML = '<div class="shop-empty">No items available</div>';
    return;
  }

  shopItems.innerHTML = shopData.map(item => `
    <div class="shop-item">
      <div class="shop-item-name">${item.name}</div>
      <div class="shop-item-price">${item.price}</div>
      <button class="shop-item-btn" onclick="buyItem(${item.id}, '${item.name}')">Buy</button>
    </div>
  `).join('');
}

function buyItem(itemId, itemName) {
  alert(`You clicked to buy: ${itemName}`);
  // In a real app, this would send a request to your backend
}

function showNotLoggedIn() {
  const profileContent = document.getElementById('profile-content');
  profileContent.innerHTML = `
    <div class="profile-not-logged-in">
      <p>You are not logged in</p>
      <p>Please sign in to view your profile</p>
    </div>
  `;
  
  // Switch to sign in tab
  switchTab('signin');
}


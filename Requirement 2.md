# Requirements Document

## 1. Application Overview

### 1.1 Application Name
Strawhatmessi

### 1.2 Application Description
A community platform website featuring a dark-themed interface with Discord authentication, navigation sidebar, and main content area displaying user profile, shop, and leaderboard sections. The platform integrates with Discord for user authentication and coin management through Discord commands.

## 2. Users and Usage Scenarios

### 2.1 Target Users
Community members who need to access their profile information, participate in leaderboards, shop for rewards, and connect with social platforms.

### 2.2 Core Usage Scenarios
- Users sign in with Discord account to access the platform
- Users view their stats, coin balance, and history
- Users browse and purchase channel rewards
- Users check coin rankings on leaderboard
- Users access community features like Wheel and Wrapped
- Users connect to external social platforms\n- Administrators manage user coin balances via Discord commands

## 3. Page Structure and Functionality

### 3.1 Overall Structure
```
├── Main Layout
    ├── Login Page
    │   ├── Logo and Branding
    │   ├── Sign In Section
    │   └── Feature Cards
    └── Authenticated Layout
        ├── Left Sidebar
        │   ├── User Info Section
        │   ├── Navigation Section
        │   ├── Wallet Section
        │   └── Community Links Section
        └── Main Content Area
            ├── Home Page
            │   ├── Welcome Section
            │   ├── Profile Card
            │   ├── Shop Card
            │   └── Leaderboard Card
            ├── Profile Page
            │   └── Profile Content
            ├── Leaderboard Page
            │   ├── Statistics Section
            │   ├── View Toggle Section
            │   ├── Time Filter Section
            │   ├── Current User Position
            │   └── Rankings List
            └── Shop Page
                ├── Page Header
                └── Rewards Grid
```

### 3.2 Login Page
\n#### 3.2.1 Logo and Branding
- Display application logo with cyan glow effect
- Display label: COMMUNITY HUB
- Display application name: Strawhatmessi\n- Display tagline: Earn Coins by winning in customs, climb the leaderboard, and unlock rewards.\n
#### 3.2.2 Sign In Section
- Display Sign in with Discord button (purple color with Discord icon)
- Display text: Free to join — sign in with your Discord account
- Button initiates Discord OAuth authentication flow
\n#### 3.2.3 Feature Cards
Display three feature cards:
\n**Earn Coins Card**
- Display lightbulb icon
- Display title: Earn Coins
- Display description: Play in customs and earn coins for your wins.\n\n**Redeem Rewards Card**
- Display shopping cart icon
- Display title: Redeem Rewards
- Display description: Spend coins in the shop on perks and goodies.

**Leaderboard Card**
- Display activity icon
- Display title: Leaderboard
- Display description: Compete with the community — track coins and Twitch Stream Watchtime.

#### 3.2.4 Footer Links
- Display Watch on Twitch button (purple color with Twitch icon)
- Display Join Discord button (blue color with Discord icon)
\n### 3.3 Left Sidebar (Authenticated Users Only)

#### 3.3.1 User Info Section\n- Display username\n- Display user type: Community\n- Include user avatar icon
- Provide search users input field

#### 3.3.2 Navigation Section
Include the following navigation items:
- Profile: Navigate to profile page
- Shop: Navigate to shop page
- Rewards: Navigate to rewards page
- Leaderboard: Navigate to leaderboard page
- Wheel: Navigate to wheel page
- Wrapped: Navigate to wrapped page\n
#### 3.3.3 Wallet Section
- Display coin balance: 0 (default for all users)
- Display wallet rank\n- Label: YOUR WALLET
\n#### 3.3.4 Community Links Section
Include links to external platforms:
- Twitch\n- Discord
- YouTube
- X / Twitter
\n### 3.4 Main Content Area - Home Page

#### 3.4.1 Welcome Section
- Display user avatar icon with purple background
- Display welcome text: Welcome back,
- Display username from Discord account
- Position at top of main content area

#### 3.4.2 Profile Card
- Display profile icon
- Display title: Profile
- Display description: View your stats, coin balance, and history
- Include right arrow indicator for navigation
- Clickable to navigate to profile page

#### 3.4.3 Shop Card
- Display shopping cart icon
- Display title: Shop
- Display description: Spend coins on exclusive channel rewards
- Include right arrow indicator for navigation
- Clickable to navigate to shop page
\n#### 3.4.4 Leaderboard Card
- Display bar chart icon
- Display title: Leaderboard
- Display description: See who's top of the coin rankings
- Include right arrow indicator for navigation
- Clickable to navigate to leaderboard page

### 3.5 Main Content Area - Profile Page

#### 3.5.1 Profile Content
- Display content based on user profile data
- Show user stats, coin balance, and history as described in profile card
\n### 3.6 Main Content Area - Leaderboard Page

#### 3.6.1 Breadcrumb Navigation
- Display breadcrumb: Home / Leaderboard
- Home link navigates back to home page

#### 3.6.2 Statistics Section
Display four statistics cards in a row:
- Total Users: 190
- Total Coins: 0 (default)
- Avg Balance: 0 (default)
- Highest Balance: 0 (default)
\n#### 3.6.3 View Toggle Section
Provide two toggle options:
- Coins: Display rankings by coin balance (default selected)
- Watch Time: Display rankings by watch time

#### 3.6.4 Time Filter Section
Provide four time filter options:
- All Time (default selected)
- This Month
- This Week
- Today
\n#### 3.6.5 Current User Position
- Display current user's rank\n- Display user avatar with purple background
- Display username from Discord account
- Display label: YOUR POSITION
- Display coin balance: 0 COINS (default)
- Highlight with distinct styling

#### 3.6.6 Rankings List
Display ranked list of users with following information for each entry:
- Rank number with badge styling
  - 1st place: Gold badge with 1ST label
  - 2nd place: Silver badge with 2ND label
  - 3rd place: Bronze badge with 3RD label
  - Other ranks: Gray badge with number only
- User avatar\n- Username
- Coin balance with COINS label (default 0 for all users)
\n### 3.7 Main Content Area - Shop Page
\n#### 3.7.1 Breadcrumb Navigation
- Display breadcrumb: Home / Shop
- Home link navigates back to home page

#### 3.7.2 Page Header
- Display shopping cart icon
- Display page title: Shop
\n#### 3.7.3 Rewards Grid
Display reward items in a grid layout with the following items:
\n**Item 1: 50 Coin Lottery**
- Display colorful wheel icon
- Display title: 50 Coin Lottery
- Display description: Entry on a wheel for a chance to win 50 coins! (Spun Monthly)
- Display cost: 1 coin icon
- Display Buy Now button (cyan color)\n- Button enabled when user has sufficient coins

**Item 2: 1 Week VIP**
- Display diamond icon
- Display title: 1 Week VIP
- Display description: Twitch VIP status for 1 week
- Display cost: 10 coin icon
- Display Buy Now button (cyan color)
- Button enabled when user has sufficient coins
\n**Item 3: Choose A Custom**
- Display gift box icon
- Display title: Choose A Custom
- Display description: Choose The Next Custom\n- Display cost: 20 coin icon
- Display Not Enough Coins button (disabled state)
- Button disabled when user has insufficient coins

**Item 4: Friend Me on Fortnite**
- Display user add icon
- Display title: Friend Me on Fortnite
- Display description: Add Andrew as a friend on Fortnite
- Display cost: 20 coin icon
- Display Not Enough Coins button (disabled state)
- Button disabled when user has insufficient coins

### 3.8 Footer
- Display copyright text: © 2026 Jorq. All rights reserved.
\n## 4. Design Requirements

### 4.1 Visual Style
- Use dark theme with black background
- Use card-based layout for main content
- Apply rounded corners to cards and buttons
- Use cyan/blue accent color for icons, highlights, and enabled buttons
- Use purple accent for user avatar background and Discord-related elements
- Use gold, silver, bronze colors for top 3 rank badges
- Use gray for disabled buttons\n- Apply glow effects to logo and branding elements
- Maintain consistent spacing and padding

### 4.2 Reference Files
- Design reference image: IMG_0617.png
- Profile page reference image: IMG_0618.png
- Leaderboard page reference image: IMG_0621.png
- Shop page reference image: IMG_0620.png
- Login page reference image: IMG_0622.png
- Use provided images as visual guide for layout, styling, and component arrangement

## 5. Business Rules and Logic

### 5.1 Authentication Rules
- Users must sign in with Discord account to access the platform
- Unauthenticated users see login page only
- Discord OAuth flow authenticates user and retrieves Discord profile information
- Username and avatar pulled from Discord account
- Session persists across browser sessions
- Users can sign out to return to login page

### 5.2 Navigation Rules
- Login page displays before authentication
- After successful authentication, users redirected to home page
- Clicking navigation items in sidebar navigates to corresponding pages
- Clicking cards on home page navigates to corresponding sections
- Active navigation item should be visually highlighted
- Clicking Profile navigation item or Profile card displays profile page content
- Clicking Leaderboard navigation item or Leaderboard card displays leaderboard page\n- Clicking Shop navigation item or Shop card displays shop page
- Breadcrumb Home link navigates back to home page
\n### 5.3 Wallet Display\n- All users start with 0 coins by default
- Coin balance updates when coins are added or removed via Discord commands
- Rank number displays user's position in community based on coin balance
\n### 5.4 Welcome Section Display
- Welcome section displays on home page only
- Username displayed matches Discord account username
\n### 5.5 Leaderboard Display Rules
- Default view shows Coins ranking for All Time
- Rankings update based on selected view toggle (Coins or Watch Time)
- Rankings update based on selected time filter\n- Current user position always displayed at top of rankings list
- Top 3 users receive special badge styling
- Rankings sorted in descending order by selected metric
- All users start with 0 coins and equal ranking\n
### 5.6 Shop Display and Purchase Rules
- Reward items displayed in grid layout
- Each item shows icon, title, description, and cost
- Buy Now button enabled when user has sufficient coins
- Buy Now button displays as Not Enough Coins and disabled when user has insufficient coins
- Clicking enabled Buy Now button initiates purchase transaction
- User coin balance deducts by item cost after successful purchase
- Purchased rewards delivered according to item type

### 5.7 Discord Integration Rules
- Discord command format for adding coins: /add coin [user] [amount]
- Discord command format for removing coins: /remove coins [user] [amount]
- Add coin command adds specified amount of coins to specified user's balance
- Remove coins command deducts specified amount of coins from specified user's balance
- Coin balance updates immediately in application after Discord command execution
- Only authorized users can execute coin management commands
- Command parameters:\n  - user: Target username to receive or lose coins
  - amount: Number of coins to add or remove (must be positive integer)
- Remove coins command cannot reduce balance below 0

## 6. Exception and Boundary Cases

| Scenario | Handling |
|----------|----------|
| Discord authentication fails | Display error message and allow retry |
| User cancels Discord OAuth | Return to login page |
| Session expires | Redirect to login page |\n| User has zero coins | Display 0 in wallet section and rankings |
| User not ranked | Display rank as N/A or hide rank |
| Navigation item unavailable | Disable item or show coming soon message |
| External link fails | Show error message or retry option |
| Profile page has no data | Display empty state message |
| No users in leaderboard | Display empty state message |
| Tie in rankings | Display users with same rank in alphabetical order |
| Time filter returns no data | Display empty state message |
| Discord command with invalid user | Return error message indicating user not found |
| Discord command with invalid amount | Return error message indicating amount must be positive integer |
| Discord command by unauthorized user | Return error message indicating insufficient permissions |
| Discord command fails to execute | Return error message and log failure |
| Remove coins command exceeds user balance | Set balance to 0 and return warning message |
| Purchase with insufficient coins | Display Not Enough Coins button in disabled state |
| Purchase transaction fails | Show error message and do not deduct coins |
| User attempts to purchase same item multiple times | Allow purchase based on item type rules |
\n## 7. Acceptance Criteria

1. Login page displays with Strawhatmessi branding and COMMUNITY HUB label
2. Login page displays Sign in with Discord button
3. Login page displays three feature cards: Earn Coins, Redeem Rewards, and Leaderboard
4. Login page displays Watch on Twitch and Join Discord footer buttons
5. Clicking Sign in with Discord initiates Discord OAuth flow
6. Successful authentication redirects to home page
7. Username and avatar pulled from Discord account
8. Left sidebar displays all required sections with correct information
9. Navigation items are clickable and functional
10. Home page displays welcome section with user avatar and Discord username
11. Home page displays three main cards: Profile, Shop, and Leaderboard
12. Each card shows correct icon, title, and description
13. Cards are clickable and navigate to corresponding pages
14. Profile navigation item and Profile card both navigate to profile page
15. Profile page displays user profile content
16. Leaderboard navigation item and Leaderboard card both navigate to leaderboard page
17. Leaderboard page displays breadcrumb navigation\n18. Leaderboard page displays four statistics cards with correct values
19. Leaderboard page provides Coins and Watch Time view toggles
20. Leaderboard page provides All Time, This Month, This Week, and Today time filters
21. Leaderboard page displays current user position with rank and coin balance
22. Leaderboard page displays ranked list of users with avatars, usernames, and coin balances\n23. Top 3 ranks display special badge styling with 1ST, 2ND, 3RD labels
24. Shop navigation item and Shop card both navigate to shop page
25. Shop page displays breadcrumb navigation
26. Shop page displays page header with shopping cart icon and title
27. Shop page displays four reward items in grid layout
28. Each reward item displays icon, title, description, and cost\n29. Reward items with sufficient user balance display enabled Buy Now button
30. Reward items with insufficient user balance display disabled Not Enough Coins button
31. Clicking enabled Buy Now button initiates purchase transaction
32. User coin balance deducts after successful purchase
33. Wallet section displays coin balance starting at 0 and rank\n34. Community links section includes all four social platform links
35. Footer displays copyright information
36. Overall layout matches reference images IMG_0617.png, IMG_0618.png, IMG_0621.png, IMG_0620.png, and IMG_0622.png
37. Dark theme is consistently applied across all components
38. Welcome section and user avatars use purple background\n39. Enabled buttons use cyan color
40. Disabled buttons use gray color
41. Application name is Strawhatmessi throughout the platform
42. All users start with 0 coins by default
43. Discord command /add coin [user] [amount] successfully adds coins to specified user\n44. Discord command /remove coins [user] [amount] successfully removes coins from specified user
45. Coin balance updates in application after Discord command execution
46. Leaderboard statistics update to reflect coin additions and removals
47. User rankings update based on coin balance changes
48. Shop button states update based on user coin balance changes
49. Remove coins command cannot reduce balance below 0
\n## 8. Out of Scope for Current Release

- Detailed profile page statistics and history display
- Wheel and Wrapped feature implementations
- Rewards page functionality
- User search functionality
- Real-time coin balance updates
- Social platform integration beyond links
- Watch Time view implementation
- Pagination for leaderboard rankings
- User profile pages for other users
- Discord command for transferring coins between users
- Coin transaction history
- Coin earning mechanisms beyond Discord commands
- Purchase history tracking
- Reward inventory management
- Refund functionality
- Item quantity limits
- Time-limited offers
- Password-based authentication
- Email notifications
- Two-factor authentication
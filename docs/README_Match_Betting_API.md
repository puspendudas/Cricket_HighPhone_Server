# Cricket Match Betting API - Quick Start Guide

## 📁 Files Created

1. **`Match_Betting_API_Postman.json`** - Complete Postman collection
2. **`Match_Betting_API_Documentation.md`** - Detailed API documentation
3. **`README_Match_Betting_API.md`** - This quick start guide

## 🚀 Quick Setup

### 1. Import Postman Collection
```bash
# Import the JSON file into Postman
# File → Import → Upload Files → Select Match_Betting_API_Postman.json
```

### 2. Set Environment Variables
Create a new environment in Postman with these variables:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3000` | Your API base URL |
| `auth_token` | `eyJhbGciOiJIUzI1NiIs...` | JWT authentication token |
| `user_id` | `507f1f77bcf86cd799439011` | Valid user ObjectId |
| `match_id` | `507f1f77bcf86cd799439012` | Valid match ObjectId |
| `bet_id` | `507f1f77bcf86cd799439013` | Valid bet ObjectId |

### 3. Test API Endpoints

#### 🎯 BOOKMAKER Betting (Team Win/Loss)
```json
// Back Bet (Betting FOR a team)
POST /api/v1/match-bets/create
{
  "bet_type": "BOOKMAKER",
  "selection": "Back",
  "selection_id": 47972,
  "odds_rate": "85",
  "stake_amount": 100,
  "team_name": "India"
}

// Lay Bet (Betting AGAINST a team)
{
  "bet_type": "BOOKMAKER",
  "selection": "Lay",
  "selection_id": 47973,
  "odds_rate": "115",
  "stake_amount": 200,
  "team_name": "Australia"
}
```

#### 🎲 FANCY Betting (Session Markets)
```json
// Yes Bet (Betting FOR an outcome)
POST /api/v1/match-bets/create
{
  "bet_type": "FANCY",
  "selection": "Yes",
  "market_id": "1.200345678",
  "odds_value": "150",
  "odds_rate": "90",
  "stake_amount": 50,
  "session_name": "India 1st Innings Runs"
}

// Not Bet (Betting AGAINST an outcome)
{
  "bet_type": "FANCY",
  "selection": "Not",
  "market_id": "1.200345679",
  "odds_value": "75",
  "odds_rate": "110",
  "stake_amount": 75,
  "session_name": "Total Sixes"
}
```

## 💰 Betting Calculations

### BOOKMAKER (Team Betting)
| Type | Win Formula | Loss Formula |
|------|-------------|---------------|
| **Back** | Stake × (Rate÷100) | Stake |
| **Lay** | Stake | Stake × (Rate÷100) |

### FANCY (Session Betting)
| Type | Win Formula | Loss Formula |
|------|-------------|---------------|
| **Yes** | Stake × (Rate÷100) | Stake |
| **Not** | Stake | Stake × (Rate÷100) |

## 📋 Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/match-bets/create` | Create new bet |
| `GET` | `/api/v1/match-bets/match/{matchId}` | Get all bets for match |
| `GET` | `/api/v1/match-bets/match/{matchId}/bookmaker` | Get BOOKMAKER bets |
| `GET` | `/api/v1/match-bets/match/{matchId}/fancy` | Get FANCY bets |
| `GET` | `/api/v1/match-bets/match/{matchId}/user/{userId}` | Get user bets for match |
| `GET` | `/api/v1/match-bets/{betId}` | Get specific bet |
| `PUT` | `/api/v1/match-bets/update/{betId}` | Update pending bet |
| `PUT` | `/api/v1/match-bets/settle/{betId}` | Settle bet (win/loss) |

## 🔧 Common Operations

### Create a Back Bet on India
1. Select "Create BOOKMAKER Bet (Back)" from Postman
2. Update `user_id`, `match_id` in request body
3. Set `team_name`: "India"
4. Set `stake_amount`: 100
5. Send request

### Get All Bets for a Match
1. Select "Get Match Bets by Match ID"
2. Replace `{{match_id}}` with actual match ID
3. Send request

### Settle a Bet as Won
1. Select "Settle Bet - Won"
2. Replace `{{bet_id}}` with actual bet ID
3. Set `isWon`: true
4. Add result description
5. Send request

## ⚠️ Important Notes

- **Authentication Required**: All endpoints need valid JWT token
- **PENDING Bets Only**: Only pending bets can be updated
- **Wallet Balance**: Users need sufficient balance for betting
- **Validation**: BOOKMAKER needs `selection_id`, FANCY needs `market_id`
- **Selections**: BOOKMAKER uses Back/Lay, FANCY uses Yes/Not

## 🐛 Troubleshooting

### Common Errors:
1. **401 Unauthorized**: Check auth_token in environment
2. **400 Bad Request**: Verify required fields for bet type
3. **404 Not Found**: Check if IDs exist in database
4. **Insufficient Balance**: User wallet has insufficient funds

### Debug Steps:
1. Verify environment variables are set
2. Check request body format matches examples
3. Ensure user and match IDs are valid ObjectIds
4. Confirm user has sufficient wallet balance

## 📖 Full Documentation
For complete API details, see `Match_Betting_API_Documentation.md`

---
**Happy Betting! 🏏**
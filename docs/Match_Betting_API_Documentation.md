# Cricket Match Betting API Documentation

## Overview
This API provides comprehensive cricket match betting functionality with support for two main bet types:
- **BOOKMAKER**: Team win/loss betting with Back/Lay options
- **FANCY**: Session betting with Yes/Not options

## Betting Logic

### BOOKMAKER Bets (Team Win/Loss)
Based on `bookMakerOdds` from match data:

| Selection | Profit Calculation | Loss Calculation |
|-----------|-------------------|------------------|
| **Back** | Stake × (Rate/100) | Stake |
| **Lay** | Stake | Stake × (Rate/100) |

**Example:**
- Back bet: Stake=100, Rate=85 → Win: 85 profit, Loss: 100 stake
- Lay bet: Stake=100, Rate=115 → Win: 100 stake, Loss: 115 liability

### FANCY Bets (Session Betting)
Based on `fancyOdds` data:

| Selection | Profit Calculation | Loss Calculation |
|-----------|-------------------|------------------|
| **Yes** | Stake × (Rate/100) | Stake |
| **Not** | Stake | Stake × (Rate/100) |

**Example:**
- Yes bet: Stake=50, Rate=90 → Win: 45 profit, Loss: 50 stake
- Not bet: Stake=50, Rate=110 → Win: 50 stake, Loss: 55 liability

## API Endpoints

### 1. Create Match Bet
**POST** `/api/v1/match-bets/create`

#### BOOKMAKER Bet Request:
```json
{
  "user_id": "user_object_id",
  "match_id": "match_object_id",
  "bet_type": "BOOKMAKER",
  "selection": "Back", // or "Lay"
  "selection_id": 47972, // from bookMakerOdds
  "odds_value": "1.85",
  "odds_rate": "85", // b1 or l1 rate
  "stake_amount": 100,
  "team_name": "India",
  "game_id": "32540047",
  "event_id": "32540047",
  "min_stake": 10,
  "max_stake": 10000,
  "is_active": true,
  "is_enabled": true
}
```

#### FANCY Bet Request:
```json
{
  "user_id": "user_object_id",
  "match_id": "match_object_id",
  "bet_type": "FANCY",
  "selection": "Yes", // or "Not"
  "market_id": "1.200345678", // from fancyOdds
  "odds_value": "150", // bs1 or ls1 value
  "odds_rate": "90", // b1 or l1 rate
  "stake_amount": 50,
  "session_name": "India 1st Innings Runs",
  "runner_name": "Over 150.5",
  "game_id": "32540047",
  "event_id": "32540047",
  "sid": "200345678",
  "min_stake": 5,
  "max_stake": 5000,
  "is_active": true,
  "is_enabled": true
}
```

### 2. Get Match Bets

#### Get All Bets
**GET** `/api/v1/match-bets?skip=0&count=20&status=PENDING`

#### Get Bets by Match
**GET** `/api/v1/match-bets/match/{matchId}`

#### Get User Bets for Match
**GET** `/api/v1/match-bets/match/{matchId}/user/{userId}`

#### Get BOOKMAKER Bets
**GET** `/api/v1/match-bets/match/{matchId}/bookmaker`

#### Get FANCY Bets
**GET** `/api/v1/match-bets/match/{matchId}/fancy`

#### Get Bet by ID
**GET** `/api/v1/match-bets/{betId}`

### 3. Update Match Bet
**PUT** `/api/v1/match-bets/update/{betId}`

```json
{
  "odds_rate": "95",
  "stake_amount": 150,
  "bet_metadata": {
    "updated_reason": "odds_change",
    "previous_odds": "90"
  }
}
```

**Note:** Only PENDING bets can be updated.

### 4. Settle Match Bet
**PUT** `/api/v1/match-bets/settle/{betId}`

```json
{
  "isWon": true, // or false
  "result": "India won by 7 wickets"
}
```

## Response Format

### Success Response:
```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": {
    // Response data
  },
  "total": 100, // For paginated responses
  "count": 20   // For paginated responses
}
```

### Error Response:
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Bet Status Types
- **PENDING**: Bet is active and awaiting settlement
- **WON**: Bet has been settled as won
- **LOST**: Bet has been settled as lost
- **CANCELLED**: Bet has been cancelled

## Validation Rules

### BOOKMAKER Bets:
- `selection_id` is required
- `selection` must be "Back" or "Lay"
- `team_name` should be provided

### FANCY Bets:
- `market_id` is required
- `selection` must be "Yes" or "Not"
- `session_name` and `runner_name` should be provided

### General:
- `stake_amount` must be between `min_stake` and `max_stake`
- User must have sufficient wallet balance
- Match must be active for betting

## Postman Collection Setup

1. Import the `Match_Betting_API_Postman.json` file into Postman
2. Set up environment variables:
   - `base_url`: Your API base URL (e.g., http://localhost:3000)
   - `auth_token`: JWT authentication token
   - `user_id`: Valid user ID for testing
   - `match_id`: Valid match ID for testing
   - `bet_id`: Valid bet ID for update/settle operations

## Testing Workflow

1. **Authentication**: Get auth token and set in environment
2. **Create Bets**: Test both BOOKMAKER and FANCY bet creation
3. **Retrieve Bets**: Test various filtering options
4. **Update Bets**: Modify pending bets
5. **Settle Bets**: Test both win and loss scenarios

## Error Handling

Common error scenarios:
- Insufficient wallet balance
- Invalid bet parameters
- Attempting to update settled bets
- Invalid match or user IDs
- Betting on inactive matches

## Security Considerations

- All endpoints require valid JWT authentication
- User can only access their own bets (except admin)
- Bet settlement requires admin privileges
- Input validation prevents malicious data

## Performance Optimization

- Database queries are optimized with proper indexing
- Pagination is implemented for large result sets
- Caching can be implemented for frequently accessed data
- Transaction handling ensures data consistency

## Integration with Match Data

### BOOKMAKER Integration:
- Uses `bookMakerOdds` array from match model
- `selection_id` maps to specific team/runner
- `b1`/`l1` rates used for Back/Lay calculations

### FANCY Integration:
- Uses `fancyOdds` model data
- `market_id` maps to specific session market
- `bs1`/`ls1` values and `b1`/`l1` rates for Yes/Not calculations

This comprehensive API supports all cricket betting scenarios with proper validation, calculation logic, and data integrity.
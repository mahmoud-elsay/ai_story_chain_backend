# AI Story Chain Server - API Test Guide

## Prerequisites
1. Start the server: `npm run dev` or `node server.js`
2. Server runs on: http://localhost:3000

## Test Endpoints

### 1. Create Room with Settings
Create a room with custom round and AI settings:

```bash
curl -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -d "{
    \"creator\": {
      \"name\": \"Mahmoud\"
    },
    \"max_rounds\": 5,
    \"ai_mode\": \"every_2_rounds\"
  }"
```

**Expected Response:**
```json
{
  "room_code": "XZ12KQ",
  "creator": "Mahmoud",
  "max_rounds": 5,
  "ai_mode": "every_2_rounds",
  "participants": ["Mahmoud"],
  "current_round": 1,
  "room": { ... }
}
```

### 2. Get Room Info
Check room details:

```bash
curl http://localhost:3000/rooms/XZ12KQ
```

### 3. Join Room
Join as a second player:

```bash
curl -X POST http://localhost:3000/rooms/XZ12KQ/join \
  -H "Content-Type: application/json" \
  -d "{
    \"player\": {
      \"name\": \"Sara\"
    }
  }"
```

**Expected Response:**
```json
{
  "room_code": "XZ12KQ",
  "participants": ["Mahmoud", "Sara"],
  "max_rounds": 5,
  "current_round": 1,
  "ai_mode": "every_2_rounds"
}
```

### 4. Add Story Part (Player Turn)
Submit a story segment:

```bash
curl -X POST http://localhost:3000/rooms/XZ12KQ/story \
  -H "Content-Type: application/json" \
  -d "{
    \"playerId\": \"player1\",
    \"content\": \"Once upon a time, there was a brave knight exploring a mysterious forest.\"
  }"
```

**Note:** Replace `player1` with actual player ID from room data.

**Expected Response:**
```json
{
  "sender": "Mahmoud",
  "message": "Once upon a time, there was a brave knight...",
  "round": 1,
  "ai_message": false,
  "roundComplete": false,
  "shouldAiPlay": false
}
```

### 5. Continue Story (Second Player)
Submit as second player:

```bash
curl -X POST http://localhost:3000/rooms/XZ12KQ/story \
  -H "Content-Type: application/json" \
  -d "{
    \"playerId\": \"player2\",
    \"content\": \"The knight heard a strange noise in the distance.\"
  }"
```

### 6. Check Game Status
Check current round and status:

```bash
curl http://localhost:3000/rooms/XZ12KQ
```

### 7. Manual AI Twist (if ai_mode is manual_only)
Force an AI contribution:

```bash
curl -X POST http://localhost:3000/rooms/XZ12KQ/twist
```

### 8. Get Story History
View complete story:

```bash
curl http://localhost:3000/rooms/XZ12KQ/story
```

### 9. Get Players List
View all players:

```bash
curl http://localhost:3000/rooms/XZ12KQ/players
```

### 10. Shuffle Players
Randomize turn order:

```bash
curl -X POST http://localhost:3000/rooms/XZ12KQ/shuffle
```

## AI Modes Explained

### 1. `every_round`
AI participates after ALL human players finish their turn in EACH round.

### 2. `every_2_rounds`
AI participates after ALL human players finish their turn in ROUND 2, 4, 6, etc.

### 3. `manual_only`
AI never participates automatically. Use `/rooms/:roomId/twist` to manually trigger AI.

## Game Flow Example

Let's trace a 3-round game with 2 players and `ai_mode: every_2_rounds`:

**Round 1:**
1. Player 1 submits: "The knight entered the forest."
2. Player 2 submits: "Suddenly, a dragon appeared!"
   - Round 1 complete → AI does NOT play (only rounds 2, 4, 6...)

**Round 2:**
3. Player 1 submits: "The knight drew his sword."
4. Player 2 submits: "The dragon roared loudly!"
   - Round 2 complete → AI DOES play automatically

**Round 3:**
5. Player 1 submits: "The knight charged forward."
6. Player 2 submits: "The dragon flew away into the clouds."
   - Round 3 complete → AI does NOT play
   - Game finished (max_rounds = 3) → `story_finished` event

## Testing the Game End

When the game finishes (reaches max_rounds), the story submission will return:

```json
{
  "type": "story_finished",
  "story": [
    {"sender": "Mahmoud", "text": "Once upon a time..."},
    {"sender": "Sara", "text": "The dragon appeared!"},
    {"sender": "AI", "text": "But destiny had other plans..."}
  ]
}
```

## Quick Test Sequence

```bash
# 1. Create room
ROOM_ID=$(curl -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -d '{"creator":{"name":"Alice"},"max_rounds":3,"ai_mode":"every_round"}' \
  | jq -r '.room_code')

echo "Room ID: $ROOM_ID"

# 2. Join room
curl -X POST http://localhost:3000/rooms/$ROOM_ID/join \
  -H "Content-Type: application/json" \
  -d '{"player":{"name":"Bob"}}'

# 3. Get room info
curl http://localhost:3000/rooms/$ROOM_ID

# 4. Add story parts (continue until max_rounds reached)
curl -X POST http://localhost:3000/rooms/$ROOM_ID/story \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player1","content":"Once upon a time..."}'
```

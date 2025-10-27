require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { handleConnection } = require('./websocket');
const {
    createRoom,
    joinRoom,
    leaveRoom,
    getRoom,
    shufflePlayers,
    getCurrentPlayer,
    nextTurn,
    generateRoomId,
    shouldAiPlay,
    checkRoundComplete,
    advanceRound,
    isGameFinished
} = require('./rooms');
const { addTwist, sanitizeContent } = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Create room with settings
app.post('/rooms', (req, res) => {
    try {
        const roomId = req.body?.roomId || generateRoomId();
        const creator = req.body?.creator || null;

        // Extract settings
        const settings = {
            maxRounds: req.body?.max_rounds || req.body?.maxRounds || 5,
            aiMode: req.body?.ai_mode || req.body?.aiMode || 'manual_only'
        };

        // Validate aiMode
        const validAiModes = ['every_round', 'every_2_rounds', 'manual_only'];
        if (!validAiModes.includes(settings.aiMode)) {
            return res.status(400).json({ error: `ai_mode must be one of: ${validAiModes.join(', ')}` });
        }

        const room = createRoom(roomId, creator, settings);

        // Return formatted response matching the user story
        return res.status(201).json({
            room_code: room.id,
            creator: creator?.name || 'Anonymous',
            max_rounds: room.maxRounds,
            ai_mode: room.aiMode,
            participants: room.players.map(p => p.name),
            current_round: room.currentRound,
            room: room // Include full room object
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// Get room info
app.get('/rooms/:roomId', (req, res) => {
    const room = getRoom(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    return res.json({ room, currentPlayer: getCurrentPlayer(req.params.roomId) });
});

// Join room
app.post('/rooms/:roomId/join', (req, res) => {
    try {
        const player = req.body?.player;
        if (!player || !player.name) {
            return res.status(400).json({ error: 'Player { id?, name } required' });
        }
        const room = joinRoom(req.params.roomId, player);

        // Return formatted response matching the user story
        return res.json({
            room_code: room.id,
            participants: room.players.map(p => p.name),
            max_rounds: room.maxRounds,
            current_round: room.currentRound,
            ai_mode: room.aiMode,
            room: room // Include full room object
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// Leave room
app.post('/rooms/:roomId/leave', (req, res) => {
    try {
        const playerId = req.body?.playerId;
        if (!playerId) return res.status(400).json({ error: 'playerId required' });
        const room = leaveRoom(req.params.roomId, playerId);
        if (!room) return res.json({ message: 'Left room; room deleted (empty)' });
        return res.json({ room, message: 'Left room' });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// Get players
app.get('/rooms/:roomId/players', (req, res) => {
    const room = getRoom(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    return res.json({ players: room.players, currentTurn: room.currentTurn, currentPlayer: getCurrentPlayer(req.params.roomId) });
});

// Shuffle players
app.post('/rooms/:roomId/shuffle', (req, res) => {
    try {
        const room = shufflePlayers(req.params.roomId);
        return res.json({ room, currentPlayer: getCurrentPlayer(req.params.roomId) });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// Get story history
app.get('/rooms/:roomId/story', (req, res) => {
    const room = getRoom(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    return res.json({ story: room.story });
});

// Add story part (turn-based with round logic)
app.post('/rooms/:roomId/story', (req, res) => {
    try {
        const { playerId, content } = req.body || {};
        if (!playerId || !content || !content.trim()) {
            return res.status(400).json({ error: 'playerId and non-empty content required' });
        }
        const roomId = req.params.roomId;
        const room = getRoom(roomId);
        if (!room) return res.status(404).json({ error: 'Room not found' });

        // Check if game is finished
        if (isGameFinished(roomId)) {
            return res.status(400).json({ error: 'Game is finished' });
        }

        const currentPlayer = getCurrentPlayer(roomId);
        if (!currentPlayer || currentPlayer.id !== playerId) {
            return res.status(403).json({ error: 'Not your turn' });
        }

        const sanitized = sanitizeContent(content.trim());
        const storyPart = {
            type: 'story_part',
            content: sanitized,
            author: currentPlayer.name,
            authorId: playerId,
            round: room.currentRound,
            timestamp: new Date().toISOString()
        };
        room.story.push(storyPart);

        // Check if round is complete
        const roundResult = advanceRound(roomId);

        const response = {
            sender: currentPlayer.name,
            message: sanitized,
            round: room.currentRound,
            ai_message: false,
            storyPart,
            room,
            roundComplete: roundResult.finished !== undefined ? roundResult.finished : checkRoundComplete(roomId),
            shouldAiPlay: shouldAiPlay(roomId)
        };

        // If game finished, add special flag
        if (roundResult.finished) {
            response.type = 'story_finished';
            response.story = room.story;
        }

        return res.status(201).json(response);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// Add AI twist
app.post('/rooms/:roomId/twist', async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const room = getRoom(roomId);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        const twist = await addTwist(roomId, room.story.map(s => s.content ?? s.content));
        room.story.push(twist);
        return res.status(201).json({ twist, room });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// WebSocket setup
const wss = new WebSocketServer({ server });
wss.on('connection', handleConnection);

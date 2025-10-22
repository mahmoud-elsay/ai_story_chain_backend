const {
    createRoom,
    joinRoom,
    leaveRoom,
    getRoom,
    getAllRooms,
    shufflePlayers,
    getCurrentPlayer,
    nextTurn,
    generateRoomId
} = require('./rooms');
const {
    addTwist,
    suggestNextPlayer,
    generateStoryPrompt,
    sanitizeContent
} = require('./ai');

// Store active connections and their room associations
const connections = new Map();
const roomConnections = new Map();

function broadcastToRoom(roomId, message, excludeWs = null) {
    const roomWs = roomConnections.get(roomId) || [];
    roomWs.forEach(ws => {
        if (ws !== excludeWs && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(message));
        }
    });
}

function addConnectionToRoom(roomId, ws) {
    if (!roomConnections.has(roomId)) {
        roomConnections.set(roomId, []);
    }
    roomConnections.get(roomId).push(ws);
}

function removeConnectionFromRoom(roomId, ws) {
    const roomWs = roomConnections.get(roomId);
    if (roomWs) {
        const index = roomWs.indexOf(ws);
        if (index > -1) {
            roomWs.splice(index, 1);
        }
        if (roomWs.length === 0) {
            roomConnections.delete(roomId);
        }
    }
}

function handleConnection(ws) {
    console.log('New WebSocket connection established');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data.type);

            switch (data.type) {
                case 'create_room':
                    await handleCreateRoom(ws, data);
                    break;

                case 'join_room':
                    await handleJoinRoom(ws, data);
                    break;

                case 'leave_room':
                    await handleLeaveRoom(ws, data);
                    break;

                case 'add_story_part':
                    await handleAddStoryPart(ws, data);
                    break;

                case 'add_ai_twist':
                    await handleAddAiTwist(ws, data);
                    break;

                case 'get_story_history':
                    await handleGetStoryHistory(ws, data);
                    break;

                case 'get_players':
                    await handleGetPlayers(ws, data);
                    break;

                case 'shuffle_players':
                    await handleShufflePlayers(ws, data);
                    break;

                case 'get_current_turn':
                    await handleGetCurrentTurn(ws, data);
                    break;

                case 'ai_suggest_next_player':
                    await handleAiSuggestNextPlayer(ws, data);
                    break;

                case 'get_room_info':
                    await handleGetRoomInfo(ws, data);
                    break;

                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Unknown message type'
                    }));
            }

        } catch (err) {
            console.error('WebSocket error:', err);
            ws.send(JSON.stringify({
                type: 'error',
                message: err.message || 'An error occurred'
            }));
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        // Clean up connection from all rooms
        for (const [roomId, roomWs] of roomConnections.entries()) {
            removeConnectionFromRoom(roomId, ws);
        }
        connections.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Welcome to AI Story Chain!',
        timestamp: new Date().toISOString()
    }));
}

async function handleCreateRoom(ws, data) {
    const roomId = data.roomId || generateRoomId();
    const creator = data.creator || { name: 'Anonymous' };

    const room = createRoom(roomId, creator);

    // Add connection to room
    addConnectionToRoom(roomId, ws);
    connections.set(ws, { roomId, playerId: creator.id });

    ws.send(JSON.stringify({
        type: 'room_created',
        room: {
            id: room.id,
            players: room.players,
            story: room.story,
            currentTurn: room.currentTurn,
            createdAt: room.createdAt
        }
    }));
}

async function handleJoinRoom(ws, data) {
    const { roomId, player } = data;

    if (!roomId || !player) {
        throw new Error('Room ID and player information required');
    }

    const room = joinRoom(roomId, player);

    // Add connection to room
    addConnectionToRoom(roomId, ws);
    connections.set(ws, { roomId, playerId: player.id });

    // Broadcast to all players in room
    broadcastToRoom(roomId, {
        type: 'player_joined',
        player: player,
        room: {
            id: room.id,
            players: room.players,
            currentTurn: room.currentTurn
        }
    }, ws);

    ws.send(JSON.stringify({
        type: 'joined_room',
        room: {
            id: room.id,
            players: room.players,
            story: room.story,
            currentTurn: room.currentTurn,
            createdAt: room.createdAt
        }
    }));
}

async function handleLeaveRoom(ws, data) {
    const { roomId, playerId } = data;
    const connection = connections.get(ws);

    if (!connection || connection.roomId !== roomId) {
        throw new Error('Not connected to this room');
    }

    const room = leaveRoom(roomId, playerId);

    // Remove connection from room
    removeConnectionFromRoom(roomId, ws);
    connections.delete(ws);

    if (room) {
        // Broadcast to remaining players
        broadcastToRoom(roomId, {
            type: 'player_left',
            playerId: playerId,
            room: {
                id: room.id,
                players: room.players,
                currentTurn: room.currentTurn
            }
        });

        ws.send(JSON.stringify({
            type: 'left_room',
            message: 'Successfully left room'
        }));
    } else {
        // Room was deleted
        ws.send(JSON.stringify({
            type: 'left_room',
            message: 'Left room - room was deleted as it became empty'
        }));
    }
}

async function handleAddStoryPart(ws, data) {
    const { roomId, playerId, content } = data;
    const connection = connections.get(ws);

    if (!connection || connection.roomId !== roomId) {
        throw new Error('Not connected to this room');
    }

    const room = getRoom(roomId);
    if (!room) {
        throw new Error('Room not found');
    }

    // Check if it's the player's turn
    const currentPlayer = getCurrentPlayer(roomId);
    if (!currentPlayer || currentPlayer.id !== playerId) {
        throw new Error('Not your turn');
    }

    if (!content || content.trim().length === 0) {
        throw new Error('Story content cannot be empty');
    }

    // Sanitize content
    const sanitizedContent = sanitizeContent(content.trim());

    // Add story part
    const storyPart = {
        type: 'story_part',
        content: sanitizedContent,
        author: currentPlayer.name,
        authorId: playerId,
        timestamp: new Date().toISOString()
    };

    room.story.push(storyPart);

    // Move to next turn
    const nextPlayer = nextTurn(roomId);

    // Broadcast to all players
    broadcastToRoom(roomId, {
        type: 'story_updated',
        storyPart: storyPart,
        room: {
            id: room.id,
            players: room.players,
            story: room.story,
            currentTurn: room.currentTurn,
            currentPlayer: nextPlayer
        }
    });
}

async function handleAddAiTwist(ws, data) {
    const { roomId } = data;
    const connection = connections.get(ws);

    if (!connection || connection.roomId !== roomId) {
        throw new Error('Not connected to this room');
    }

    const room = getRoom(roomId);
    if (!room) {
        throw new Error('Room not found');
    }

    // Generate AI twist
    const twist = await addTwist(roomId, room.story.map(s => s.content));

    // Add twist to story
    room.story.push(twist);

    // Broadcast to all players
    broadcastToRoom(roomId, {
        type: 'ai_twist_added',
        twist: twist,
        room: {
            id: room.id,
            players: room.players,
            story: room.story,
            currentTurn: room.currentTurn,
            currentPlayer: getCurrentPlayer(roomId)
        }
    });
}

async function handleGetStoryHistory(ws, data) {
    const { roomId } = data;
    const room = getRoom(roomId);

    if (!room) {
        throw new Error('Room not found');
    }

    ws.send(JSON.stringify({
        type: 'story_history',
        story: room.story
    }));
}

async function handleGetPlayers(ws, data) {
    const { roomId } = data;
    const room = getRoom(roomId);

    if (!room) {
        throw new Error('Room not found');
    }

    ws.send(JSON.stringify({
        type: 'players_list',
        players: room.players,
        currentTurn: room.currentTurn,
        currentPlayer: getCurrentPlayer(roomId)
    }));
}

async function handleShufflePlayers(ws, data) {
    const { roomId } = data;
    const room = shufflePlayers(roomId);

    if (!room) {
        throw new Error('Room not found');
    }

    // Broadcast to all players
    broadcastToRoom(roomId, {
        type: 'players_shuffled',
        room: {
            id: room.id,
            players: room.players,
            currentTurn: room.currentTurn,
            currentPlayer: getCurrentPlayer(roomId)
        }
    });
}

async function handleGetCurrentTurn(ws, data) {
    const { roomId } = data;
    const currentPlayer = getCurrentPlayer(roomId);

    ws.send(JSON.stringify({
        type: 'current_turn',
        currentPlayer: currentPlayer,
        roomId: roomId
    }));
}

async function handleAiSuggestNextPlayer(ws, data) {
    const { roomId } = data;
    const room = getRoom(roomId);

    if (!room) {
        throw new Error('Room not found');
    }

    const suggestion = await suggestNextPlayer(room.players, room.currentTurn);

    ws.send(JSON.stringify({
        type: 'ai_player_suggestion',
        suggestion: suggestion,
        currentPlayer: getCurrentPlayer(roomId)
    }));
}

async function handleGetRoomInfo(ws, data) {
    const { roomId } = data;
    const room = getRoom(roomId);

    if (!room) {
        throw new Error('Room not found');
    }

    ws.send(JSON.stringify({
        type: 'room_info',
        room: {
            id: room.id,
            players: room.players,
            story: room.story,
            currentTurn: room.currentTurn,
            currentPlayer: getCurrentPlayer(roomId),
            createdAt: room.createdAt,
            isActive: room.isActive
        }
    }));
}

module.exports = { handleConnection };

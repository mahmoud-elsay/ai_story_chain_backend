const rooms = {};

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom(roomId = null, creator = null, settings = {}) {
    const id = roomId || generateRoomId();

    if (!rooms[id]) {
        rooms[id] = {
            id: id,
            players: [],
            story: [],
            currentTurn: 0,
            createdAt: new Date().toISOString(),
            isActive: true,
            // Game flow settings
            maxRounds: settings.maxRounds || 5,
            currentRound: 1,
            aiMode: settings.aiMode || 'manual_only', // 'every_round', 'every_2_rounds', 'manual_only'
            roundStarts: new Date().toISOString(),
            submissions: [], // Track submissions per round
            settings: settings
        };

        // Add creator if provided
        if (creator) {
            rooms[id].players.push({
                id: creator.id || Date.now().toString(),
                name: creator.name,
                joinedAt: new Date().toISOString()
            });
        }
    }
    return rooms[id];
}

function joinRoom(roomId, player) {
    const room = rooms[roomId];
    if (!room) {
        throw new Error('Room not found');
    }

    if (!room.isActive) {
        throw new Error('Room is no longer active');
    }

    // Check if player already exists
    const existingPlayer = room.players.find(p => p.id === player.id);
    if (existingPlayer) {
        return room; // Player already in room
    }

    room.players.push({
        id: player.id || Date.now().toString(),
        name: player.name,
        joinedAt: new Date().toISOString()
    });

    return room;
}

function leaveRoom(roomId, playerId) {
    const room = rooms[roomId];
    if (!room) {
        throw new Error('Room not found');
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
        throw new Error('Player not found in room');
    }

    room.players.splice(playerIndex, 1);

    // Adjust current turn if necessary
    if (room.currentTurn >= room.players.length && room.players.length > 0) {
        room.currentTurn = room.currentTurn % room.players.length;
    }

    // Delete room if empty
    if (room.players.length === 0) {
        delete rooms[roomId];
        return null;
    }

    return room;
}

function getRoom(roomId) {
    return rooms[roomId] || null;
}

function getAllRooms() {
    return Object.values(rooms);
}

function shufflePlayers(roomId) {
    const room = rooms[roomId];
    if (!room) {
        throw new Error('Room not found');
    }

    if (room.players.length < 2) {
        return room; // No need to shuffle with less than 2 players
    }

    // Shuffle players array
    for (let i = room.players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [room.players[i], room.players[j]] = [room.players[j], room.players[i]];
    }

    // Reset turn to first player
    room.currentTurn = 0;

    return room;
}

function getCurrentPlayer(roomId) {
    const room = rooms[roomId];
    if (!room || room.players.length === 0) {
        return null;
    }

    return room.players[room.currentTurn];
}

function nextTurn(roomId) {
    const room = rooms[roomId];
    if (!room) {
        throw new Error('Room not found');
    }

    if (room.players.length === 0) {
        return null;
    }

    room.currentTurn = (room.currentTurn + 1) % room.players.length;
    return room.players[room.currentTurn];
}

function shouldAiPlay(roomId) {
    const room = rooms[roomId];
    if (!room) return false;

    // Count non-AI submissions in current round
    const currentRoundSubmissions = room.story.filter(s =>
        s.round === room.currentRound && s.authorId !== 'AI'
    ).length;

    switch (room.aiMode) {
        case 'every_round':
            // AI plays after all human players finish each round
            return currentRoundSubmissions >= room.players.length;

        case 'every_2_rounds':
            // AI plays after all human players finish every 2nd round
            return room.currentRound % 2 === 0 && currentRoundSubmissions >= room.players.length;

        case 'manual_only':
        default:
            return false;
    }
}

function checkRoundComplete(roomId) {
    const room = rooms[roomId];
    if (!room) return false;

    const currentRoundHumanSubmissions = room.story.filter(s =>
        s.round === room.currentRound && s.authorId !== 'AI'
    ).length;

    return currentRoundHumanSubmissions >= room.players.length;
}

function advanceRound(roomId) {
    const room = rooms[roomId];
    if (!room) return false;

    if (checkRoundComplete(roomId)) {
        room.currentRound++;
        room.roundStarts = new Date().toISOString();

        // Check if game is finished
        if (room.currentRound > room.maxRounds) {
            room.isActive = false;
            return { finished: true, round: room.currentRound - 1 };
        }

        return { finished: false, round: room.currentRound };
    }

    return { finished: false, round: room.currentRound };
}

function isGameFinished(roomId) {
    const room = rooms[roomId];
    if (!room) return false;
    return !room.isActive || room.currentRound > room.maxRounds;
}

module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    getRoom,
    getAllRooms,
    shufflePlayers,
    getCurrentPlayer,
    nextTurn,
    generateRoomId,
    shouldAiPlay,
    checkRoundComplete,
    advanceRound,
    isGameFinished
};

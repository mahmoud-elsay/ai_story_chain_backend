const rooms = {};

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom(roomId = null, creator = null) {
    const id = roomId || generateRoomId();

    if (!rooms[id]) {
        rooms[id] = {
            id: id,
            players: [],
            story: [],
            currentTurn: 0,
            createdAt: new Date().toISOString(),
            isActive: true
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

module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    getRoom,
    getAllRooms,
    shufflePlayers,
    getCurrentPlayer,
    nextTurn,
    generateRoomId
};

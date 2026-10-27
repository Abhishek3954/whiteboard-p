import { WebSocketServer } from 'ws';
import { deleteRoom } from './server.js';
import { Room, createIdPool, initPubSub, publishEvent } from './roomModel.js';

let wss = null;

function broadcastToLocal(roomCode, data, excludeWs = null) {
  if (!wss) return;
  const msg = typeof data === 'string' ? data : JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === 1 && client.room === roomCode) {
      client.send(msg);
    }
  });
}

function broadcastMembers(roomCode, members) {
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.room === roomCode) {
      const others = members.filter((i) => i.name !== client.name);
      client.send(JSON.stringify({ type: 'names', members: others }));
    }
  });
}

function onRemoteEvent(doc) {
  if (!doc || !doc.room) return;

  switch (doc.type) {
    case 'broadcast':
      broadcastToLocal(doc.room, doc.payload);
      break;

    case 'members_updated':
      broadcastMembers(doc.room, doc.members);
      break;

    case 'permission_updated':
      broadcastMembers(doc.room, doc.members);
      if (doc.targetName && doc.tools) {
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && client.room === doc.room && client.name === doc.targetName) {
            client.send(JSON.stringify({ type: 'tools', ...doc.tools }));
          }
        });
      }
      break;

    case 'kick':
      if (doc.targetName) {
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && client.room === doc.room && client.name === doc.targetName) {
            client.send(JSON.stringify({ type: 'kicked' }));
            client.close(1000, 'kicked by host');
          }
        });
      }
      break;

    case 'member_left':
      broadcastMembers(doc.room, doc.members);
      if (doc.newHostName) {
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && client.room === doc.room && client.name === doc.newHostName) {
            client.isHost = true;
            client.send(JSON.stringify({ type: 'makeHost' }));
          }
        });
      }
      break;
  }
}

function initSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });
  initPubSub(onRemoteEvent);

  wss.on('connection', (ws) => {
    ws.name = null;
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('error', (err) => {
      if (err.code !== 'ECONNRESET') {
        console.error('WebSocket error:', err);
      }
    });

    ws.on('message', async (message) => {
      let data;
      try {
        data = JSON.parse(message);
      } catch (err) {
        console.error('Invalid message format:', err);
        return;
      }

      if (data.type === 'join') {
        const code = data.code;
        const username = data.name;
        const isHost = Boolean(data.isHost);

        try {
          let room = null;
          let assignedId = null;

          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              room = await Room.findOne({ code });
              if (!room) {
                const idPool = createIdPool();
                try {
                  room = await Room.create({ code, idPool, members: [], strokes: [] });
                } catch (createErr) {
                  room = await Room.findOne({ code });
                }
              }

              let existing = room.members.find((m) => m.name === username);
              if (existing) {
                assignedId = existing.color;
                existing.isHost = isHost;
              } else {
                if (room.idPool.length === 0) {
                  ws.send(JSON.stringify({ type: 'error', message: 'room is full' }));
                  return;
                }
                assignedId = room.idPool.pop();
                room.members.push({
                  name: username,
                  color: assignedId,
                  isHost,
                  allowPencil: true,
                  allowHighlighter: true,
                  allowEraser: false,
                  allowClear: false
                });
              }

              await room.save();
              break;
            } catch (err) {
              if (err.name === 'VersionError' && attempt < 4) {
                continue;
              }
              throw err;
            }
          }

          if (!room) return;

          ws.userId = assignedId;
          ws.room = code;
          ws.name = username;
          ws.isHost = isHost;

          // Broadcast member list to local clients
          broadcastMembers(code, room.members);

          // Publish updated members list to other pods
          publishEvent({
            type: 'members_updated',
            room: code,
            members: room.members
          });

          // Sends Initial Tool Authority data to non-Hosts
          if (!ws.isHost) {
            ws.send(JSON.stringify({ type: 'tools', pencil: true, highlighter: true, eraser: false, clear: false }));
          }

          ws.send(JSON.stringify({
            type: 'syncStrokes',
            strokes: room.strokes
          }));

          ws.send(JSON.stringify({ type: 'color', id: assignedId }));
          console.log(`${ws.name} connected to room ${code}`);
        } catch (err) {
          console.error('Error during room join:', err);
        }
        return;
      }

      if (data.type === 'message') {
        if (!ws.room) return;

        const payload = { type: 'message', id: ws.userId, name: ws.name, text: `${data.text}` };

        // Broadcast locally
        broadcastToLocal(ws.room, payload, ws);

        // Broadcast to other pods
        publishEvent({
          type: 'broadcast',
          room: ws.room,
          payload
        });
        return;
      }

      // receive canvas changes and broadcasts them (pencil, eraser, live and fullStroke)
      if (['preview', 'fullStroke', 'erase', 'undo', 'redo', 'clear'].includes(data.type)) {
        if (!ws.room) return;

        // Broadcast locally
        broadcastToLocal(ws.room, data, ws);

        // Broadcast to other pods
        publishEvent({
          type: 'broadcast',
          room: ws.room,
          payload: data
        });

        // Persist stroke modifications to MongoDB
        if (data.type === 'fullStroke') {
          Room.updateOne({ code: ws.room }, { $push: { strokes: data } }).catch((err) => console.error(err));
        } else if (data.type === 'undo') {
          Room.updateOne({ code: ws.room }, { $pull: { strokes: { id: data.id } } }).catch((err) => console.error(err));
        } else if (data.type === 'redo') {
          Room.updateOne({ code: ws.room }, { $push: { strokes: data.stroke } }).catch((err) => console.error(err));
        } else if (data.type === 'clear') {
          Room.updateOne({ code: ws.room }, { $set: { strokes: [] } }).catch((err) => console.error(err));
        } else if (data.type === 'erase') {
          Room.updateOne({ code: ws.room }, { $pull: { strokes: { id: data.strokeId } } }).catch((err) => console.error(err));
        }
        return;
      }

      // Updating permissions
      if (data.type === 'updatePermission' && ws.isHost) {
        if (!ws.room) return;

        try {
          const room = await Room.findOne({ code: ws.room });
          if (!room) return;

          const target = room.members.find((m) => m.name === data.targetName);
          if (target) {
            target[data.permission] = data.value;
            await room.save();

            const tools = {
              pencil: target.allowPencil,
              highlighter: target.allowHighlighter,
              eraser: target.allowEraser,
              clear: target.allowClear
            };

            broadcastMembers(ws.room, room.members);
            wss.clients.forEach((client) => {
              if (client.readyState === 1 && client.room === ws.room && client.name === data.targetName) {
                client.send(JSON.stringify({ type: 'tools', ...tools }));
              }
            });

            publishEvent({
              type: 'permission_updated',
              room: ws.room,
              targetName: data.targetName,
              members: room.members,
              tools
            });
          }
        } catch (err) {
          console.error('Error updating permission:', err);
        }
        return;
      }

      // Kick Members
      if (data.type === 'kick' && ws.isHost) {
        if (!ws.room) return;

        wss.clients.forEach((client) => {
          if (client.readyState === 1 && client.room === ws.room && client.name === data.targetName) {
            client.send(JSON.stringify({ type: 'kicked' }));
            client.close(1000, 'kicked by host');
          }
        });

        publishEvent({
          type: 'kick',
          room: ws.room,
          targetName: data.targetName
        });
        return;
      }
    });

    ws.on('close', async () => {
      console.log(ws.name, 'disconnected');
      if (ws.userId && ws.room) {
        try {
          let room = null;
          let newHostName = null;

          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              room = await Room.findOne({ code: ws.room });
              if (!room) return;

              // Put the ID back into the pool for the next person
              if (!room.idPool.includes(ws.userId)) {
                room.idPool.push(ws.userId);
              }

              room.members = room.members.filter((m) => m.name !== ws.name);

              // Make new host if current Host leaves
              if (ws.isHost && room.members.length > 0) {
                room.members[0].isHost = true;
                room.members[0].allowPencil = true;
                room.members[0].allowHighlighter = true;
                room.members[0].allowEraser = true;
                room.members[0].allowClear = true;
                newHostName = room.members[0].name;

                wss.clients.forEach((client) => {
                  if (client.readyState === 1 && client.room === ws.room && client.name === newHostName) {
                    client.isHost = true;
                    client.send(JSON.stringify({ type: 'makeHost' }));
                  }
                });
              }

              await room.save();
              break;
            } catch (err) {
              if (err.name === 'VersionError' && attempt < 4) {
                continue;
              }
              throw err;
            }
          }

          if (!room) return;

          // If room is empty (all 30 IDs are back or members empty), delete the room
          if (room.members.length === 0 || room.idPool.length === 30) {
            await deleteRoom(ws.room);
          } else {
            // Update members list for remaining local members
            broadcastMembers(ws.room, room.members);

            // Publish update to remote pods
            publishEvent({
              type: 'member_left',
              room: ws.room,
              members: room.members,
              newHostName
            });
          }
        } catch (err) {
          console.error('Error during disconnect cleanup:', err);
        }
      }
    });
  });

  // kills zombie connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 20000);

  wss.on('close', () => clearInterval(interval));
}

export { initSocket };

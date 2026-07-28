import { WebSocketServer } from 'ws';
import {deleteRoom} from './server.js'

let wss = null;
const rooms = {};

function initSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' })
  
  wss.on('connection', (ws) => {
    ws.name = null;
    ws.isAlive = true;
    ws.on('pong', () => ws.isAlive = true)

    ws.on('error', (err) => {
        if (err.code !== 'ECONNRESET') {
          console.error('WebSocket error:', err);
        }
      });
    
    ws.on('message', (message) => {
      const data = JSON.parse(message);
      
      if (data.type === 'join') {

        // Color ID Allocation >
        
        if (!rooms[data.code]) {
          const idPool = Array.from({ length: 30 }, (_, i) => i + 1);
          for (let i = idPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [idPool[i], idPool[j]] = [idPool[j], idPool[i]];
          }
                
          rooms[data.code] = { idPool, members: [], strokes: [] };
        }
        const room = rooms[data.code];
        if (room.idPool.length === 0) {
          ws.send(JSON.stringify({ type: 'error', message: 'room is full' }));
          return;
        }
        const assignedId = room.idPool.pop();
        
        ws.userId = assignedId;

        // < Color ID Allocation
        
        ws.room = data.code;
        ws.name = data.name;
        ws.isHost = data.isHost;

        room.members.push({
          name: ws.name, color: ws.userId, isHost: ws.isHost,
          allowPencil: true, allowHighlighter: true, allowEraser: false, allowClear: false
        });
        
        // Broadcast Member Names
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && client.room === ws.room) {
            const others = room.members.filter((i) => i.name !== client.name)
            client.send(JSON.stringify({ type: 'names', members: others }));
          }
        })

        // Sends Initial Tool Authority data to non-Hosts
        if (!ws.isHost) {
          ws.send(JSON.stringify({ type: 'tools', pencil: true, highlighter: true, eraser: false, clear: false }));
        }

        ws.send(JSON.stringify({
          type: 'syncStrokes',
          strokes: room.strokes
        }))
        
        ws.send(JSON.stringify({ type: 'color', id: assignedId }));
        console.log(`${ws.name} connected`)
        return;
      }
      
      
      if (data.type === 'message') {
        if (!ws.room) return;

        // Broadcast a message to all connections in the room with client's color id
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1 && client.room === ws.room) {
            client.send(JSON.stringify({ type: 'message', id: ws.userId, name: ws.name, text: `${data.text}` }));
            }
          })
        };

      // receive canvas changes and broadcasts them (pencil, eraser, live and fullStroke)
      if (['preview', 'fullStroke', 'erase', 'undo', 'redo', 'clear'].includes(data.type)) {
        const room = rooms[ws.room]
        if (data.type === 'fullStroke') room.strokes.push(data);
        if (data.type === 'undo') { room.strokes = room.strokes.filter(i =>  i.id !== data.id ) };
        if (data.type === 'redo') room.strokes.push(data.stroke);
        if (data.type === 'clear') room.strokes = [];
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1 && client.room === ws.room) {
            client.send(JSON.stringify(data));
            };
          });
        };
      
      // Updating permissions
      if (data.type === 'updatePermission' && ws.isHost) {
        const room = rooms[ws.room];
        if (!room) return;

        const target = room.members.find(m => m.name === data.targetName);
        if (target) {
          target[data.permission] = data.value

          wss.clients.forEach(client => {
            if (client.readyState === 1 && client.room === ws.room) {
              const others = room.members.filter(m => m.name !== client.name)
              client.send(JSON.stringify({ type: 'names', members: others }));

              if (client.name === data.targetName) {
                client.send(JSON.stringify({
                  type: 'tools',
                  pencil: target.allowPencil,
                  highlighter: target.allowHighlighter,
                  eraser: target.allowEraser,
                  clear: target.allowClear
                  }))
                }
              }
            })
          }
        }

      // Kick Members
      if (data.type === 'kick' && ws.isHost) {
        wss.clients.forEach(client => {
          if (client.readyState === 1 && client.room === ws.room && client.name === data.targetName) {
            client.send(JSON.stringify({ type: 'kicked' }));
            client.close(1000, 'kicked by host');
          }
        })
        }
      });
    
    ws.on('close', () => {
      console.log(ws.name, 'disconnected');
      if (ws.userId && ws.room && rooms[ws.room]) {
        const room = rooms[ws.room];
        // Put the ID back into the pool for the next person
        room.idPool.push(ws.userId);

        room.members = room.members.filter((m) => m.name !== ws.name);

        // Make new host if current Host leaves
        if (ws.isHost && room.members.length > 0) {
          room.members[0].isHost = true;
          // Automatically unlock all tools for the new host
          room.members[0].allowPencil = true;
          room.members[0].allowHighlighter = true;
          room.members[0].allowEraser = true;
          room.members[0].allowClear = true;

          wss.clients.forEach((client) => {
            if (client.readyState === 1 && client.name == room.members[0].name) {
              client.send(JSON.stringify({ type: 'makeHost' }));
            }
          })
        }


        // update members list for remaining members
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && client.room === ws.room) {
              const others = room.members.filter((i)=>i.name !== client.name)
              client.send(JSON.stringify({ type: 'names', members: others }));
          }
        });
        
        // If room is empty (all 30 IDs are back), delete the room
        if (room.idPool.length === 30) {
          deleteRoom(ws.room);
          delete rooms[ws.room];
        }
        
      }
    });
  });

  // kills zombie connections
  setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 20000)

  wss.on('close', () => clearInterval(interval));
};

export { initSocket };
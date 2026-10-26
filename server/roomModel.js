import mongoose from 'mongoose';
import os from 'os';

// Unique identifier for this pod/process instance
export const POD_ID = process.env.HOSTNAME || `${os.hostname()}-${Math.random().toString(36).slice(2, 9)}`;

const MemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: Number, required: true },
  isHost: { type: Boolean, default: false },
  allowPencil: { type: Boolean, default: true },
  allowHighlighter: { type: Boolean, default: true },
  allowEraser: { type: Boolean, default: false },
  allowClear: { type: Boolean, default: false }
}, { _id: false });

const RoomSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true, index: true },
  idPool: { type: [Number], default: [] },
  members: { type: [MemberSchema], default: [] },
  strokes: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, { timestamps: true });

export const Room = mongoose.model('Room', RoomSchema);

// Generates a shuffled pool of color IDs (1..30)
export function createIdPool() {
  const pool = Array.from({ length: 30 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

let isListening = false;

/**
 * Initializes the MongoDB capped collection for inter-pod Pub/Sub
 */
export async function initPubSub(onRemoteEvent) {
  if (isListening) return;

  const init = async () => {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      const collections = await db.listCollections({ name: 'room_events' }).toArray();
      if (collections.length === 0) {
        try {
          await db.createCollection('room_events', {
            capped: true,
            size: 16 * 1024 * 1024, // 16 MB buffer
            max: 50000
          });
        } catch (err) {
          // Handled if created concurrently by another pod
        }
      }

      // Ensure at least one document exists so tailable cursor starts without error
      const docCount = await db.collection('room_events').countDocuments();
      if (docCount === 0) {
        await db.collection('room_events').insertOne({
          type: '__init__',
          createdAt: new Date()
        });
      }

      // Capture the latest document ID so we only listen to subsequent events
      let lastId = null;
      const latestDoc = await db.collection('room_events').find().sort({ $natural: -1 }).limit(1).next();
      if (latestDoc) {
        lastId = latestDoc._id;
      }

      isListening = true;
      startTailing(db, lastId, onRemoteEvent);
    } catch (err) {
      console.error('Error initializing MongoDB PubSub:', err);
      setTimeout(init, 3000);
    }
  };

  if (mongoose.connection.readyState === 1) {
    init();
  } else {
    mongoose.connection.once('open', init);
  }
}

async function startTailing(db, initialLastId, onRemoteEvent) {
  let lastId = initialLastId;

  while (true) {
    try {
      const query = lastId ? { _id: { $gt: lastId } } : {};
      const cursor = db.collection('room_events').find(query, {
        tailable: true,
        awaitData: true,
        noCursorTimeout: true
      });

      for await (const doc of cursor) {
        lastId = doc._id;
        if (!doc || doc.type === '__init__' || doc.senderPod === POD_ID) {
          continue;
        }
        try {
          onRemoteEvent(doc);
        } catch (eventErr) {
          console.error('Error handling remote event:', eventErr);
        }
      }
    } catch (err) {
      // On network disruption or cursor drop, retry after 1s
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

/**
 * Publishes an event to all pods via the MongoDB capped collection
 */
export async function publishEvent(eventData) {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    await db.collection('room_events').insertOne({
      ...eventData,
      senderPod: POD_ID,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('Failed to publish inter-pod event:', err);
  }
}

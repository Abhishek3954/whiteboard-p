import dotenv from 'dotenv';
import { createServer } from 'http';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import {initSocket} from './websocket.js'
import generateKey from './hostkey.js';
import { Room } from './roomModel.js';

dotenv.config();

const app = express();
app.use(express.json())
app.use(cors({
  origin: '*'
}))

const createRateLimiter = (windowMs, max) => {
  const requests = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, window] of requests) {
      if (now >= window.resetAt) requests.delete(ip);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip;
    let window = requests.get(ip);

    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + windowMs };
      requests.set(ip, window);
    }

    window.count += 1;
    if (window.count > max) {
      res.set('Retry-After', String(Math.ceil((window.resetAt - now) / 1000)));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    next();
  };
};

const loginLimiter = createRateLimiter(15 * 60 * 1000, 10);
const signupLimiter = createRateLimiter(60 * 60 * 1000, 5);
const hostCodeLimiter = createRateLimiter(15 * 60 * 1000, 10);
const checkCodeLimiter = createRateLimiter(15 * 60 * 1000, 30);

const server = createServer(app);
initSocket(server);

const mongoURL = process.env.mongoURL || 'mongodb://localhost:27017/whiteboard';

mongoose.connect(mongoURL)
  .then(() => { console.log('mongodb connected') })
  .catch((err) => { console.error('an error occured', err) })

const UserSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  password: {type: String, required: true}
})

const CodeSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  code: { type: String, unique: true, required: true }
})

UserSchema.pre('save', async function(){
  if (!this.isModified('password')) return;
  
  try {
    const salt = await bcrypt.genSalt(10);
  
    this.password = await bcrypt.hash(this.password, salt);
    
  }
  catch (err) {
    console.log(err)
  }
})

const User = mongoose.model('User', UserSchema);
const Code = mongoose.model('Code', CodeSchema);

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.post('/signup', signupLimiter, async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const password = req.body?.password;
    if (!name || name.length > 100 || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Invalid name or password' });
    }

    const existingUser = await User.findOne({ name })
    if (existingUser) {
      return res.status(409).json({message: 'User already exists'})
    }
    const newUser = User({ name: name, password: password });
    await newUser.save();
    res.status(201).json({message: 'user saved'})
  }
  catch (err) {
    res.status(400).json({message: err.message})
  }
})

app.post('/login', loginLimiter, async (req, res) => {
  try{
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const password = req.body?.password;
    if (!name || name.length > 100 || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Invalid name or password' });
    }

    const user = await User.findOne({ name });
    if (!user) { return res.status(401).json({ message: 'User does not exist' }) }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) { return res.status(401).json({ message: 'Incorrect Password' }) }
    
    res.status(200).json({ message: 'Login Successful' });
  }
  catch (err) {
    res.status(500).json({message: 'Server Error'})
  }
})

app.get('/hostCode/:username', hostCodeLimiter, async (req, res) => {
  try {
    let key = generateKey();
    while (await Code.findOne({code: key})) {
      key = generateKey();
    }
    const name = req.params.username
    await Code.findOneAndDelete({ name: name });
    const newKey = new Code({ name: name, code: key });
    await newKey.save();
    res.send(key);
  }
  catch (err) {
    res.status(401).json({ message: err.message });
  }
})

app.get('/checkCode/:code', checkCodeLimiter, async (req, res) => {
  try {
    const code = req.params.code;
    const response = await Code.findOne({ code: code });
    if (!response) throw new Error('Invalid Code')
    res.status(200).json({ message: 'Code Valid', code: code });
  }
  catch (err) {
    console.log(err.message);
    res.status(401).json({ message: err.message });
  }
})

export const deleteRoom = async (roomCode) => {
  try {
    await Code.findOneAndDelete({ code: roomCode });
    await Room.findOneAndDelete({ code: roomCode });  
  }
  catch (err) {
    console.log(err.message);
  }
}

server.listen(process.env.PORT || 8080 , '0.0.0.0' ,()=>{console.log(`running on port ${process.env.PORT || 8080}`)});

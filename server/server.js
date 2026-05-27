import dotenv from 'dotenv';
import { createServer } from 'http';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import {initSocket} from './websocket.js'
import generateKey from './hostkey.js'

dotenv.config();

const app = express();
app.use(express.json())
app.use(cors({
  origin: 'https://whiteboard-private.vercel.app/'
}))
const server = createServer(app);
initSocket(server);

const mongoURL = process.env.mongoURL;

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

app.get('/healthcheck', (req, res) => {
  res.status(200).send('Server is healthy and awake!');
});

app.post('/signup', async (req, res) => {
  try {
    const { name, password } = req.body;
    const existingUser = await User.findOne({ name: name })
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

app.post('/login', async (req, res) => {
  try{
    const { name, password } = req.body;
    const user = await User.findOne({ name: name });
    if (!user) { return res.status(401).json({ message: 'User does not exist' }) }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) { return res.status(401).json({ message: 'Incorrect Password' }) }
    
    res.status(200).json({ message: 'Login Successful' });
  }
  catch (err) {
    res.status(500).json({message: 'Server Error'})
  }
})

app.get('/hostCode/:username', async (req, res) => {
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

app.get('/checkCode/:code', async (req, res) => {
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
  }
  catch (err) {
    console.log(err.message);
  }
}

server.listen(process.env.PORT || 8080, ()=>{console.log(`running on port ${process.env.PORT}`)});

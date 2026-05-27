# Whiteboard

This is a collaborative whiteboard application built as a learning project to explore WebSockets and the HTML5 Canvas API. **This is just a learning project, not a real production-ready utility.**
https://whiteboard-private.vercel.app/

[![screenshot](App/public/screenshot-main.png)](https://whiteboard-private.vercel.app/)

## Features

- ✏️ Live Drawing
- 💬 Live chat
- 👑 Host permissions (enable and disable members from using specific tools)
- ⏪/⏩ Undo/Redo
- 🖍️ Highlighter
- 🧽 Eraser

## Tools Used

### Frontend (`/App`)
- **React.js** - UI Library
- **Vite** - Build Tool & Development Server
- **Tailwind CSS** - Styling
- **HTML5 Canvas** - Drawing functionality

### Backend (`/server`)
- **Node.js & Express.js** - Server framework
- **ws** - WebSocket communication for real-time drawing and chat
- **MongoDB** - Database for users and session rooms
- **bcrypt** - for Hashing passwords

## How to Run Locally

To get this project running on your local machine, you will need to start both the frontend and backend servers.

### 1. Prerequisites
- [Node.js](https://nodejs.org/) installed
- [MongoDB](https://www.mongodb.com/try/download/community) installed and running locally, or a MongoDB Atlas account.

### 2. Backend Setup
Navigate to the `server` directory, install dependencies, and start the server:

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory and add your MongoDB connection strings:
```env
mongoLocalURL="mongodb://127.0.0.1:27017/"
# Optional: If you prefer using Atlas locally
# mongoAtlasURL="your_mongodb_atlas_connection_string"
```

Start the backend server:
```bash
node server.js
```
The server will run on `http://localhost:8080`.

### 3. Frontend Setup
Open a new terminal, navigate to the `App` directory, install dependencies, and start the development server:

```bash
cd App
npm install
npm run dev
```
The frontend will typically run on `http://localhost:5173`. Open this URL in your browser to see the application.

### See a Bug? or want to add a new feature
feel free to fork the project, update it and start a pull request.

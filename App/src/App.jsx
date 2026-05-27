import './App.css';
import Selection from './pages/selection.jsx';
import { useState } from 'react'
import Signup from './pages/signup.jsx'
import Login from './pages/login.jsx'
import Home from './pages/home.jsx'
import Room from './pages/room.jsx'
import Host from './pages/host.jsx'
import Preroom from './pages/pre-room.jsx';
import { AuthProvider } from './context/AuthContext.jsx'
import { SocketProvider, useSocket } from './context/SocketContext.jsx';

function Views() {
  const [view, setView] = useState(() => {
    const saved = JSON.parse(sessionStorage.getItem('user'));
    return saved ? saved.view : 'selection';
  })
  
  function setViewAndSave(newView) {
    const existingUser = JSON.parse(sessionStorage.getItem('user')) || {};
    const updatedUser = { ...existingUser, view: newView };
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
    setView(newView)
}
  
  const { handleDisconnect } = useSocket();

  return (
    <>
      {view === 'selection' && (
        <div className="fixed top-6 left-0 right-0 flex justify-center items-center pointer-events-none z-50">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-widest text-white font-mono uppercase">
            WhiteBoard
          </h1>
        </div>
      )}
      {view === 'selection' && <Selection onSignupClick={() => { setViewAndSave('signup') }} onLoginClick={() => { setViewAndSave('login') }} />}
      {view === 'signup' && <Signup onBack={() => { setViewAndSave('selection') }} onSuccess={()=>{setViewAndSave('selection')}} />}
      {view === 'login' && <Login onBack={() => { setViewAndSave('selection') }} onSuccess={()=>{setViewAndSave('home')}}  />}
      {view === 'home' && <Home onRoom={() => { setViewAndSave('pre-room') }} onHost={() => { setViewAndSave('host') }} onLogout={()=>{setViewAndSave('selection')}}/>}
      {view === 'room' && <Room className='relative w-full h-screen' onBack={() => { setViewAndSave('home'); handleDisconnect(); }} />}
      {view === 'host' && <Host onBack={() => { setViewAndSave('home') }} onCreate={() => { setView('room') }} />}
      {view === 'pre-room' && <Preroom onBack={() => { setViewAndSave('home') }} onSuccess={()=>{setView('room')}} />}
    </>
  )
}

function App() {
  
  return (
    <AuthProvider>
      <SocketProvider>
          <Views />
      </SocketProvider>
    </AuthProvider>
  )
    
}

export default App

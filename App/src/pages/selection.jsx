import { useAuth } from '../context/AuthContext.jsx';

function Selection({ onSignupClick, onLoginClick}) {
  const { signupMessage } = useAuth();
  
  return (
    <div className='flex flex-col justify-center items-center h-screen bg-slate-800'>
      <button className='font-mono transition-all text-5xl border-2 rounded-md border-black bg-green-300 hover:bg-green-500 active:bg-green-600 m-3 px-3 py-1' onClick={onSignupClick}>Sign up</button>
      <button className='font-mono transition-all text-5xl border-2 rounded-md border-black bg-green-300 hover:bg-green-500 active:bg-green-600 m-3 px-3 py-1' onClick={onLoginClick}>Log in</button>
      <p className='font-bold mt-6 transition-all text-white text-2xl'>{signupMessage}</p>
    </div>
  )
}

export default Selection
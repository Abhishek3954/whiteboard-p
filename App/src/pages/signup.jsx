import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx';

function Signup({ onBack, onSuccess }) {
  const { handleSignupSubmit, signupError } = useAuth();
  const nameRef = useRef(null);
  const passwordRef = useRef(null);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = nameRef.current.value;
    const password = passwordRef.current.value;
    try {
      if (!name && !password) {
        throw new Error('you cannot leave the fields empty')
      }
      else if (!name) {
        throw new Error('name field cannot be empty');
      }
      else if (!password) {
        throw new Error('password field cannot be empty');
      }
      else if (password.length < 6) {
        throw new Error('password must be atleast 6 characters');
      }
      await handleSignupSubmit({ name, password })
      onSuccess();
    }
    catch (err) {
      setError(err.message);
    }
  }
  
  return (
    <div className='bg-slate-800 h-screen'>
      <button className="font-bold transition-all text-3xl bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-lg m-3 px-4"
        onClick={onBack}> Go Back</button>
      
      <form>
        
        <label className='text-2xl text-white transition-all font-bold' htmlFor='nameInput'>Create Username:</label>
        <input className='text-2xl transition-all border-4 border-gray-800 bg-gray-200 text-emerald-700 font-bold rounded-md ml-3 mb-4 pl-2 py-1'
          type='text' id='nameInput' ref={nameRef} placeholder='Username' />
        <br />
        <label className='text-2xl text-white transition-all font-bold' htmlFor='passwordInput'>Create Password:</label>
        <input className='text-2xl transition-all border-4 border-gray-800 bg-gray-200 text-emerald-700 font-bold rounded-md ml-5 pl-2 py-1'
          type='password' id='passwordInput' ref={passwordRef} placeholder='Create Password' />
        <br />
        
        <button className='font-mono transition-all text-3xl border-2 rounded-md border-black bg-green-300 hover:bg-green-500 active:bg-green-600 m-3 px-3 py-1'
          type='button' onClick={handleSubmit}>Sign Up</button>
        
      </form>
      <p id='errorP' style={{ color: 'red' }}>{signupError ? signupError:error}</p>
      
    </div>
  )
}

export default Signup
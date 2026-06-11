import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorPlay, Joystick, ArrowLeft, Save } from 'lucide-react';

export default function Home() {
  const [pin, setPin] = useState('');
  const [showHostPassword, setShowHostPassword] = useState(false);
  const [hostPassword, setHostPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim().length === 6) {
      navigate(`/join/${pin.trim()}`);
    }
  };

  const handleHostLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (hostPassword === 'KTCNPRO') {
      navigate('/host');
    } else {
      setPasswordError(true);
      setTimeout(() => setPasswordError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#46178f] flex flex-col items-center justify-center p-4 font-sans select-none relative">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-2xl p-8 transform transition-all active:scale-[0.99]">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-2 mb-4">
            <div className="flex w-12 h-12 bg-white rounded-xl shadow border border-gray-200 items-center justify-center">
              <div className="w-6 h-6 bg-[#46178f] rounded-sm transform rotate-45"></div>
            </div>
          </div>
          <h1 className="text-4xl font-black text-[#333] tracking-tighter italic mb-2">KTCN-TEST</h1>
          <p className="text-gray-400 font-bold tracking-widest text-sm uppercase">Join a Game</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.toUpperCase())}
            placeholder="Game PIN"
            className="w-full text-center text-2xl font-black tracking-widest p-4 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-[#46178f] transition-all"
          />
          <button
            type="submit"
            disabled={pin.length !== 6}
            className="w-full bg-[#333] hover:bg-black disabled:opacity-50 text-white font-bold text-xl py-4 rounded-xl shadow-lg border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            Enter
          </button>
        </form>

        <div className="mt-8 pt-6 border-t-[3px] border-dashed border-gray-100 text-center">
          <p className="text-gray-400 font-bold mb-4 text-sm">Want to create your own quiz?</p>
          {!showHostPassword ? (
            <button
              onClick={() => setShowHostPassword(true)}
              className="text-white bg-[#1368ce] hover:bg-blue-700 font-bold py-3 px-6 rounded-xl shadow border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 w-full"
            >
              <MonitorPlay size={20} />
              Host a Game
            </button>
          ) : (
            <form onSubmit={handleHostLogin} className="space-y-3">
              <input
                type="password"
                value={hostPassword}
                onChange={(e) => setHostPassword(e.target.value)}
                placeholder="Host Password"
                className={`w-full text-center font-bold p-3 bg-gray-50 border-2 rounded-xl outline-none focus:border-[#1368ce] transition-all ${passwordError ? 'border-red-500 bg-red-50 text-red-500' : 'border-gray-200'}`}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowHostPassword(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-600 font-bold py-3 px-4 rounded-xl flex-shrink-0 transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <button
                  type="submit"
                  disabled={!hostPassword}
                  className="bg-[#1368ce] hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl flex-grow shadow border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all"
                >
                  Verify
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

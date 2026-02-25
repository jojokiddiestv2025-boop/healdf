/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ChatScreen } from './components/ChatScreen';

export default function App() {
  const [screen, setScreen] = useState<'welcome' | 'chat'>('welcome');

  return (
    <div className="min-h-screen bg-warm-white text-stone-900 font-sans">
      {screen === 'welcome' ? (
        <WelcomeScreen onStart={() => setScreen('chat')} />
      ) : (
        <ChatScreen onBack={() => setScreen('welcome')} />
      )}
    </div>
  );
}

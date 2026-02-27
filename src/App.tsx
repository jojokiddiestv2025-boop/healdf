/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LiveVoiceScreen } from './components/LiveVoiceScreen';

export default function App() {
  const [screen, setScreen] = useState<'welcome' | 'voice'>('welcome');

  return (
    <div className="min-h-screen bg-warm-white text-stone-900 font-sans">
      {screen === 'welcome' && (
        <WelcomeScreen 
          onStartVoice={() => setScreen('voice')}
        />
      )}
      {screen === 'voice' && (
        <LiveVoiceScreen onEnd={() => setScreen('welcome')} />
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, X, Loader2 } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// We'll inline the audio logic here for simplicity and direct access to state if the hook gets too complex
// But let's try to use the hook pattern if possible.
// Actually, let's just put the logic in the component for now to ensure we have full control over the audio context and visualizer.

interface LiveVoiceScreenProps {
  onEnd: () => void;
}

export function LiveVoiceScreen({ onEnd }: LiveVoiceScreenProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'disconnected'>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false); // AI is speaking
  const [isListening, setIsListening] = useState(false); // User is speaking (detected via volume)
  const [volume, setVolume] = useState(0);

  // Refs for cleanup
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const connect = useCallback(async () => {
    try {
      setStatus('connecting');

      // 1. Setup Audio Context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // 2. Setup Gemini Client
      // Try both standard env var and the one potentially injected by AI Studio
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        console.error("No API key found");
        setStatus('error');
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const config = {
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction: {
            parts: [{ text: "You are MMA, a compassionate and empathetic AI counsellor. Your voice should be calm, soothing, and supportive. Listen actively to the user. Keep your responses concise and natural, like a real conversation. Do not use long monologues. Ask open-ended questions to help the user explore their feelings." }]
          },
        },
      };

      // 3. Connect
      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: async () => {
            console.log("Connected to Gemini Live");
            setStatus('connected');
            startRecording();
          },
          onmessage: (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              playAudio(base64Audio);
              setIsSpeaking(true);
            }

            if (message.serverContent?.interrupted) {
              console.log("Interrupted");
              stopAudioPlayback();
              setIsSpeaking(false);
            }
            
            if (message.serverContent?.turnComplete) {
               setIsSpeaking(false);
            }
          },
          onclose: () => {
            console.log("Session closed");
            setStatus('disconnected');
          },
          onerror: (err) => {
            console.error("Session error:", err);
            setStatus('error');
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (error) {
      console.error("Connection failed:", error);
      setStatus('error');
    }
  }, []);

  const startRecording = async () => {
    if (!audioContextRef.current || !sessionRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }});
      streamRef.current = stream;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Use ScriptProcessor for simplicity in this environment
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0; // Mute input to avoid feedback

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(Math.min(1, rms * 5)); // Boost sensitivity
        setIsListening(rms > 0.01);

        // Convert to PCM 16-bit
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Base64 encode
        let binary = '';
        const bytes = new Uint8Array(pcmData.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);

        // Send to Gemini
        sessionRef.current.sendRealtimeInput({
          media: {
            mimeType: "audio/pcm;rate=16000",
            data: base64
          }
        });
      };

      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

    } catch (error) {
      console.error("Error starting recording:", error);
      setStatus('error');
    }
  };

  const playAudio = (base64Data: string) => {
    if (!audioContextRef.current) return;

    // Decode base64
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      const int = int16Data[i];
      float32Data[i] = int < 0 ? int / 0x8000 : int / 0x7FFF;
    }

    const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    // Track active sources for cancellation
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
    };
    activeSourcesRef.current.push(source);

    const currentTime = audioContextRef.current.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.05;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  };

  const stopAudioPlayback = () => {
    // Stop all currently playing sources
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if source already stopped
      }
    });
    activeSourcesRef.current = [];

    if (audioContextRef.current) {
        nextStartTimeRef.current = audioContextRef.current.currentTime;
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
        sessionRef.current = null;
    }
    if (processorRef.current && sourceRef.current) {
      processorRef.current.disconnect();
      sourceRef.current.disconnect();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    onEnd();
  };

  // Auto-connect on mount? No, let's require a click for safety or try auto-connect and handle failure.
  // Actually, let's try auto-connect. If it fails, we show a retry button.
  useEffect(() => {
    // connect(); // Removed auto-connect to prevent audio context issues
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-warm-white flex flex-col items-center justify-center z-50">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative w-full max-w-md aspect-square flex items-center justify-center"
      >
        {/* Ambient Background */}
        <div className="absolute inset-0 bg-olive/5 rounded-full blur-3xl animate-pulse" />

        {/* Status Indicator */}
        <div className="absolute top-10 text-center z-20">
          <h2 className="text-2xl font-serif text-olive mb-2">Healing with MMA</h2>
          <p className="text-sm font-mono text-stone-500 uppercase tracking-widest flex items-center justify-center gap-2">
            {status === 'idle' && "Tap microphone to start"}
            {status === 'connecting' && <><Loader2 className="w-3 h-3 animate-spin" /> Connecting...</>}
            {status === 'connected' && (isSpeaking ? "Speaking..." : "Listening...")}
            {status === 'error' && "Connection Error"}
            {status === 'disconnected' && "Disconnected"}
          </p>
        </div>

        {/* Visualizer Orb */}
        <div className="relative flex items-center justify-center">
          {/* Outer Ripples */}
          <AnimatePresence>
            {(isSpeaking || isListening) && (
              <>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-32 h-32 rounded-full border border-olive/20"
                />
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                  className="absolute w-32 h-32 rounded-full border border-olive/10"
                />
              </>
            )}
          </AnimatePresence>

          {/* Main Orb */}
          <motion.div
            animate={{
              scale: isSpeaking ? [1, 1.2, 1] : isListening ? [1, 1.05 + volume, 1] : 1,
            }}
            transition={{
              duration: isSpeaking ? 0.5 : 0.1,
              repeat: isSpeaking ? Infinity : 0,
              ease: "easeInOut"
            }}
            className="w-32 h-32 bg-gradient-to-br from-olive to-olive-light rounded-full shadow-xl flex items-center justify-center relative z-10 cursor-pointer hover:scale-105 transition-transform"
            onClick={() => {
              if (status === 'idle' || status === 'error' || status === 'disconnected') connect();
            }}
          >
            {status === 'connecting' ? (
               <Loader2 className="w-8 h-8 text-white/90 animate-spin" />
            ) : (
               <Mic className="w-8 h-8 text-white/90" />
            )}
          </motion.div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-20 flex gap-6 z-20">
          <button 
            onClick={disconnect}
            className="p-4 bg-white rounded-full shadow-lg hover:shadow-xl hover:bg-red-50 text-red-500 transition-all group"
          >
            <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}


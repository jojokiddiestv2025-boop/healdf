import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Send, User, Bot, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface ChatScreenProps {
  onBack: () => void;
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Hello. I'm here to listen. How are you feeling today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Construct history for context
      // Note: In a real app, we'd manage history more robustly.
      // For this simple version, we'll send the last few messages or rely on the model's stateless nature with context injection if needed.
      // But better to use chat session.
      
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "You are a compassionate, empathetic, and non-judgmental AI counsellor named Serenity. Your goal is to help the user explore their thoughts and feelings. Ask open-ended questions. Validate their emotions. Avoid giving direct advice unless asked. Maintain a warm, professional, and supportive tone. Keep responses concise but meaningful.",
        },
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }))
      });

      const result = await chat.sendMessage({ message: userMessage });
      const response = result.text || "I'm sorry, I couldn't generate a response.";

      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      setMessages(prev => [...prev, { role: 'model', content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-warm-white font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="font-serif text-xl font-medium text-stone-800">Serenity</h1>
          <p className="text-xs text-stone-500 font-mono uppercase tracking-widest">AI Counsellor</p>
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={clsx(
              "flex w-full",
              message.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div className={clsx(
              "flex max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm",
              message.role === 'user' 
                ? "bg-olive text-white rounded-tr-none" 
                : "bg-white text-stone-800 rounded-tl-none border border-stone-100"
            )}>
              <div className="flex-shrink-0 mr-3 mt-1">
                {message.role === 'user' ? null : <Bot className="w-5 h-5 text-olive/70" />}
              </div>
              <div className="prose prose-sm max-w-none break-words leading-relaxed">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start w-full"
          >
            <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-sm border border-stone-100 flex items-center gap-2">
              <Bot className="w-5 h-5 text-olive/70" />
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-stone-200">
        <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-stone-50 rounded-3xl p-2 border border-stone-200 focus-within:border-olive/50 focus-within:ring-1 focus-within:ring-olive/20 transition-all shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 max-h-32 min-h-[44px] py-3 px-4 bg-transparent border-none focus:ring-0 resize-none text-stone-800 placeholder:text-stone-400"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-olive text-white rounded-full hover:bg-olive-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm mb-1 mr-1"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-center text-xs text-stone-400 mt-2">
          AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  );
}

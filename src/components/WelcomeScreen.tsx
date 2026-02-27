import { motion } from 'motion/react';
import { ArrowRight, Sparkles, Mic } from 'lucide-react';

interface WelcomeScreenProps {
  onStartVoice: () => void;
}

export function WelcomeScreen({ onStartVoice }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-olive/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-olive/10 rounded-full blur-3xl" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 text-center max-w-2xl"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-white rounded-full shadow-sm">
            <Sparkles className="w-8 h-8 text-olive" />
          </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-serif font-medium text-olive mb-6 tracking-tight">
          Healing with MMA
        </h1>
        
        <p className="text-lg md:text-xl text-gray-600 mb-12 font-light leading-relaxed max-w-lg mx-auto">
          A safe space to explore your thoughts, navigate your feelings, and find clarity in a complex world.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartVoice}
            className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-olive rounded-full overflow-hidden transition-all hover:bg-olive-light shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-olive"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Mic className="w-5 h-5" /> Begin Voice Session
            </span>
          </motion.button>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-8 text-sm text-gray-400 font-mono flex flex-col items-center gap-2"
      >
        <span>Private & Confidential • AI Powered</span>
      </motion.div>
    </div>
  );
}

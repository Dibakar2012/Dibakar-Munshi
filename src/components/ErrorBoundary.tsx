import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white font-sans">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full glass p-10 rounded-[2.5rem] border border-white/10 text-center space-y-8 shadow-[0_0_100px_rgba(59,130,246,0.1)]"
          >
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
              <AlertCircle className="text-red-500" size={40} />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl font-black tracking-tighter uppercase">System Error</h1>
              <p className="text-sm text-white/40 font-medium leading-relaxed">
                Something went wrong while processing your request. Our systems have logged this incident.
              </p>
              {this.state.error && (
                <div className="mt-4 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl text-[10px] font-mono text-red-400/80 text-left overflow-auto max-h-32 custom-scrollbar">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-primary hover:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary/20"
              >
                <RefreshCw size={18} /> Restart Dibakar AI
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-white/5 hover:bg-white/10 text-white/60 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-white/5"
              >
                <Home size={18} /> Back to Home
              </button>
            </div>

            <p className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">
              Error Code: 0x554A2B
            </p>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

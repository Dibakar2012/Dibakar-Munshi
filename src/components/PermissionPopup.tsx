import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Camera, Mic, FolderOpen, X, Check } from 'lucide-react';

interface PermissionPopupProps {
  onClose: () => void;
}

export default function PermissionPopup({ onClose }: PermissionPopupProps) {
  const [step, setStep] = useState(0);
  const permissions = [
    {
      id: 'camera',
      title: 'Camera Access',
      description: 'Allow access to your camera for video features.',
      icon: <Camera className="text-primary" size={24} />,
      permission: 'camera'
    },
    {
      id: 'microphone',
      title: 'Microphone Access',
      description: 'Allow access to your microphone for voice search.',
      icon: <Mic className="text-secondary" size={24} />,
      permission: 'microphone'
    },
    {
      id: 'location',
      title: 'Location Access',
      description: 'Allow access to your location for better search results.',
      icon: <Shield className="text-primary" size={24} />,
      permission: 'geolocation'
    },
    {
      id: 'files',
      title: 'File Storage',
      description: 'Allow access to store and retrieve files.',
      icon: <FolderOpen className="text-secondary" size={24} />,
      permission: 'files'
    }
  ];

  const handleRequest = async () => {
    const current = permissions[step];
    
    try {
      if (current.id === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
      } else if (current.id === 'microphone') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } else if (current.id === 'location') {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
      } else if (current.id === 'files') {
        if (navigator.storage && navigator.storage.persist) {
          await navigator.storage.persist();
        }
      }
    } catch (err) {
      console.warn(`Permission for ${current.id} denied or failed:`, err);
    }

    if (step < permissions.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface border border-border w-[92%] max-w-[400px] rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-border flex items-center justify-between bg-surface-hover">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Shield className="text-primary" size={20} />
            </div>
            <h2 className="font-bold text-lg">App Permissions</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-full text-text-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <motion.div
              key={step}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 bg-surface-hover rounded-3xl flex items-center justify-center border border-border"
            >
              {permissions[step].icon}
            </motion.div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">{permissions[step].title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">
                {permissions[step].description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {permissions.map((_, i) => (
              <div 
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-8 bg-primary' : 'w-2 bg-border'
                }`}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleRequest}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
            >
              <Check size={20} /> {step === permissions.length - 1 ? 'Finish' : 'Allow Access'}
            </button>
            <button
              onClick={() => step < permissions.length - 1 ? setStep(step + 1) : onClose()}
              className="w-full py-3 text-sm text-text-muted hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>

        <div className="p-4 bg-surface-hover border-t border-border text-center">
          <p className="text-[10px] text-text-muted uppercase tracking-widest">
            You can change these later in your browser settings
          </p>
        </div>
      </motion.div>
    </div>
  );
}

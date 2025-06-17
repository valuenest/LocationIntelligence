import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useState } from "react";

interface AnalysisLoadingModalProps {
  isOpen: boolean;
}

export default function AnalysisLoadingModal({ isOpen }: AnalysisLoadingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dots, setDots] = useState('');

  const steps = [
    "Analyzing location coordinates...",
    "Scanning nearby amenities...",
    "Calculating traffic patterns...",
    "Evaluating infrastructure...",
    "Processing market trends...",
    "Generating AI insights...",
    "Finalizing investment analysis..."
  ];

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setDots('');
      return;
    }

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length);
    }, 800);

    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 300);

    return () => {
      clearInterval(stepInterval);
      clearInterval(dotsInterval);
    };
  }, [isOpen, steps.length]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md border-0 bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
        <div className="flex flex-col items-center text-center py-8">
          {/* AI Brain Animation */}
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse"></div>
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-bounce"></div>
            </div>
            {/* Scanning lines */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
            <div className="absolute inset-1 rounded-full border-2 border-transparent border-r-purple-500 animate-spin animate-reverse"></div>
          </div>

          {/* AI Analysis Text */}
          <h3 className="text-xl font-bold text-gray-800 mb-2">AI Analysis in Progress</h3>
          <p className="text-gray-600 mb-6 min-h-[24px]">
            {steps[currentStep]}{dots}
          </p>

          {/* Progress Bar */}
          <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-800 ease-in-out"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-blue-400 rounded-full opacity-30 animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: '2s'
                }}
              ></div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
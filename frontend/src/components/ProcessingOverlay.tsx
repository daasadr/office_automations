import { useEffect, useState } from 'react';

interface ProcessingOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

export function ProcessingOverlay({ isVisible, onClose }: ProcessingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(1);
      return;
    }

    // Step 2: Convert (after 3 seconds)
    const timer1 = setTimeout(() => {
      setCurrentStep(2);
    }, 3000);

    // Step 3: Analyze (after 6 seconds)
    const timer2 = setTimeout(() => {
      setCurrentStep(3);
    }, 6000);

    // Cleanup timers
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-background rounded-lg p-8 max-w-md mx-4 text-center shadow-xl border">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <svg className="w-16 h-16 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8z"></path>
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Zpracovávám dokument</h3>
          <p className="text-muted-foreground mb-4">
            Prosím počkejte, PDF se převádí na obrázek a analyzuje pomocí AI...
          </p>
        </div>

        {/* Progress Steps */}
        <div className="space-y-3 text-left">
          {/* Step 1: Upload */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              ✓
            </div>
            <span className="text-sm">Soubor nahrán</span>
          </div>

          {/* Step 2: Convert */}
          <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep >= 2 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted border-2 border-primary'
            }`}>
              {currentStep >= 2 ? (
                '✓'
              ) : (
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              )}
            </div>
            <span className={`text-sm ${currentStep >= 2 ? '' : 'text-muted-foreground'}`}>
              {currentStep >= 2 ? 'Analýza dokumentu' : 'Analýza dokumentu'}
            </span>
          </div>

          {/* Step 3: Analyze */}
          <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
              currentStep >= 3 
                ? 'bg-primary text-primary-foreground' 
                : currentStep === 3 
                  ? 'bg-muted border-2 border-primary' 
                  : 'bg-muted border-2 border-muted-foreground'
            }`}>
              {currentStep >= 3 ? (
                '✓'
              ) : currentStep === 3 ? (
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              ) : (
                <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
              )}
            </div>
            <span className={`text-sm ${currentStep >= 3 ? '' : currentStep === 3 ? '' : 'text-muted-foreground'}`}>
              {currentStep >= 3 ? 'Zpracování dokumentu' : 'Zpracování dokumentu'}
            </span>
          </div>
        </div>

        {/* Estimated Time */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Odhadovaný čas: 10-30 sekund
          </p>
        </div>
      </div>
    </div>
  );
}

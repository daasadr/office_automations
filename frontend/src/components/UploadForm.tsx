import { useState, useRef, useCallback, useEffect } from 'react';
import { ProcessingOverlay } from './ProcessingOverlay';

export function UploadForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug: Check if component is hydrated
  useEffect(() => {
    console.log('UploadForm component hydrated on client!');
    setIsHydrated(true);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Prosím vyberte pouze PDF soubory.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Soubor je příliš velký. Maximální velikost je 10MB.');
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleAreaClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    if (!selectedFile) {
      alert('Prosím vyberte soubor k nahrání.');
      return;
    }

    setIsSubmitting(true);
    setShowProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/validate-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Chyba při zpracování souboru');
      }

      const result = await response.json();
      
      // Redirect to check page with job ID
      window.location.href = `/check?job=${result.jobId}`;
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Došlo k neočekávané chybě. Prosím zkuste to znovu.');
      setIsSubmitting(false);
      setShowProcessing(false);
    }
  };

  const handleCloseProcessing = () => {
    setShowProcessing(false);
    setIsSubmitting(false);
  };

  return (
    <>
      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className="space-y-6"
        encType="multipart/form-data"
      >
        <div className="w-full max-w-2xl mx-auto space-y-6">
          {/* File Input */}
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver 
                ? 'border-primary bg-primary/10' 
                : selectedFile 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
            }`}
            onClick={handleAreaClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf,application/pdf" 
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 text-muted-foreground">
                {selectedFile ? (
                  <svg className="w-full h-full text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                ) : (
                  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                )}
              </div>
              <div className="space-y-2">
                {selectedFile ? (
                  <>
                    <p className="text-lg font-medium text-primary">
                      Soubor vybrán
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Klikněte pro výběr jiného souboru
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium">
                      <strong>Klikněte pro nahrání</strong> nebo přetáhněte soubor
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PDF soubory do 10MB
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button 
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8 min-w-40"
            >
              {isSubmitting ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8z"></path>
                  </svg>
                  Zpracovávám data...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  Nahrát a zpracovat
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <ProcessingOverlay 
        isVisible={showProcessing} 
        onClose={handleCloseProcessing}
      />
    </>
  );
}

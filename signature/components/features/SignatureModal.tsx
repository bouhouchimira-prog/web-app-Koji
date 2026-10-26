'use client';

import { Fragment, useRef, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Eraser, Pencil, Type, ShieldCheck } from 'lucide-react';

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (signature: string) => void;
  submitting?: boolean;
}

export function SignatureModal({ open, onClose, onConfirm, submitting = false }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typed, setTyped] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = 180;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#0E172C';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    }
    setHasSig(false);
  }, [open, mode]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSig(true);
  };

  const stopDraw = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
    setTyped('');
  };

  const handleConfirm = () => {
    if (mode === 'draw' && canvasRef.current && hasSig) {
      onConfirm(canvasRef.current.toDataURL('image/png'));
    } else if (mode === 'type' && typed.trim()) {
      onConfirm(typed.trim());
    }
  };

  const canConfirm = mode === 'draw' ? hasSig : typed.trim().length > 0;

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <Dialog.Title className="text-lg font-bold text-gray-900">Apposer votre signature</Dialog.Title>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6">
                <div className="inline-flex p-1 bg-gray-50 rounded-full">
                  <button
                    onClick={() => setMode('draw')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                      mode === 'draw' ? 'bg-[#1D5FE1] text-white shadow' : 'text-gray-500'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Dessiner
                  </button>
                  <button
                    onClick={() => setMode('type')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                      mode === 'type' ? 'bg-[#1D5FE1] text-white shadow' : 'text-gray-500'
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" /> Taper
                  </button>
                </div>
              </div>

              <div className="px-6 mt-4">
                <div className="relative bg-gray-50/60 border border-gray-100 rounded-xl p-4">
                  <button onClick={clear} className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-semibold text-gray-600 hover:bg-gray-50 z-10">
                    <Eraser className="w-3 h-3" /> Effacer
                  </button>

                  {mode === 'draw' ? (
                    <div className="relative h-44 flex flex-col items-center justify-end">
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={stopDraw}
                        onMouseLeave={stopDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={stopDraw}
                      />
                      {!hasSig && (
                        <Pencil className="w-10 h-10 text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                      <div className="border-b border-gray-300 w-full" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-2">Signer ici</p>
                    </div>
                  ) : (
                    <div className="h-44 flex flex-col items-center justify-center">
                      <input
                        type="text"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder="Tapez votre nom"
                        className="w-full text-center text-2xl font-serif italic text-gray-900 bg-transparent border-b border-gray-300 focus:border-[#1D5FE1] outline-none py-2"
                      />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-3">Signer ici</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4">
                <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
                  Annuler
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm || submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D5FE1] hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full text-sm font-bold shadow-lg shadow-[#1D5FE1]/30 transition-colors"
                >
                  {submitting && <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Valider la signature
                </button>
              </div>

              <div className="bg-[#F0F4FF] px-6 py-3 flex items-center justify-center gap-2 text-[#1D5FE1]">
                <ShieldCheck className="w-4 h-4" />
                <p className="text-[11px] font-bold uppercase tracking-wider">Signature sécurisée et conforme eIDAS</p>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

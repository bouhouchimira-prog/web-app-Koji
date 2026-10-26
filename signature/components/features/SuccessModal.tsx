'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Check, ArrowLeft, Eye } from 'lucide-react';

interface SuccessModalProps {
  open: boolean;
  onClose: () => void;
  clientName?: string;
}

export function SuccessModal({ open, onClose, clientName = 'Client' }: SuccessModalProps) {
  const initials = clientName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-[#1D5FE1] flex items-center justify-center shadow-lg shadow-[#1D5FE1]/30">
                  <Check className="w-8 h-8 text-white" strokeWidth={3} />
                </div>
                <Dialog.Title className="text-xl font-bold text-gray-900 mt-5">
                  Devis signé avec succès
                </Dialog.Title>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-sm">
                  Votre signature électronique a été enregistrée et sécurisée. Vous recevrez une copie du devis signé par email.
                </p>

                <div className="w-full mt-6 bg-gray-50/60 border border-gray-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 text-left mb-3">
                    Signataire
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#1D5FE1]/10 flex items-center justify-center text-[10px] font-bold text-[#1D5FE1]">
                        {initials}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{clientName}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      Signé
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full mt-6">
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1D5FE1] hover:bg-blue-700 text-white rounded-full text-sm font-bold shadow-lg shadow-[#1D5FE1]/30 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Retour au devis
                  </button>
                  <button className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full text-sm font-bold transition-colors">
                    <Eye className="w-4 h-4" /> Voir le suivi
                  </button>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

'use client';

import { useState } from 'react';
import { Eye, EyeOff, Shield } from 'lucide-react';

interface Props {
  code: string;
}

function maskCode(code: string): string {
  if (code.length <= 4) return '••••';
  return code.slice(0, 2) + '••'.repeat(Math.floor((code.length - 4) / 2)) + code.slice(-2);
}

export default function CodeAccesBox({ code }: Props) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 mt-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        <Shield className="w-3 h-3 inline mr-1" />
        Code d&apos;accès cadre d&apos;astreinte
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <code className="font-mono font-bold text-base tracking-widest text-primary bg-white border border-gray-200 px-3 py-1.5 rounded-lg select-all">
          {revealed ? code : maskCode(code)}
        </code>
        <button
          onClick={() => setRevealed(prev => !prev)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition"
          type="button"
        >
          {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {revealed ? 'Masquer' : 'Afficher'}
        </button>
        <p className="text-xs text-gray-400">À transmettre uniquement aux personnes autorisées.</p>
      </div>
    </div>
  );
}

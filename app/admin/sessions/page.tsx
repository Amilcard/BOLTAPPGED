'use client';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS, formatDate } from '@/lib/utils';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stay, StaySession } from '@/lib/types';

export default function AdminSessions() {
  const [stays, setStays] = useState<Stay[]>([]);
  const [selectedStay, setSelectedStay] = useState<string>('');
  const [sessions, setSessions] = useState<StaySession[]>([]);
  const [editingSession, setEditingSession] = useState<StaySession | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchStays = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    const res = await fetch('/api/admin/stays', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setStays(data);
      if (data.length && !selectedStay) setSelectedStay(data[0].id);
    }
  };

  const fetchSessions = async () => {
    if (!selectedStay) return;
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    const res = await fetch(`/api/admin/stays/${selectedStay}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setSessions(await res.json());
  };

  useEffect(() => { fetchStays(); }, []);
  useEffect(() => { fetchSessions(); }, [selectedStay]);

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Supprimer cette session ?')) return;
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    await fetch(`/api/admin/stays/${selectedStay}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchSessions();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-primary">Sessions</h1>
        <Button onClick={() => setIsCreating(true)} disabled={!selectedStay}>
          <Plus size={20} className="mr-2" /> Nouvelle session
        </Button>
      </div>

      <div className="mb-6">
        <select
          className="border rounded-lg px-4 py-2 w-full max-w-md"
          value={selectedStay}
          onChange={(e) => setSelectedStay(e.target.value)}
        >
          {stays.map((stay) => (
            <option key={stay.id} value={stay.id}>{stay.title}</option>
          ))}
        </select>
      </div>

      {(isCreating || editingSession) && (
        <SessionForm
          session={editingSession}
          stayId={selectedStay}
          onClose={() => { setIsCreating(false); setEditingSession(null); }}
          onSave={() => { fetchSessions(); setIsCreating(false); setEditingSession(null); }}
        />
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Début</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Fin</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Places totales</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Places restantes</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">{formatDate(session.startDate)}</td>
                <td className="px-6 py-4">{formatDate(session.endDate)}</td>
                <td className="px-6 py-4">{session.seatsTotal}</td>
                <td className="px-6 py-4">
                  <span className={session.seatsLeft === 0 ? 'text-red-600 font-semibold' : ''}>
                    {session.seatsLeft}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingSession(session)} className="p-2 hover:bg-gray-100 rounded">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => handleDelete(session.id)} className="p-2 hover:bg-red-50 text-red-600 rounded">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionForm({ session, stayId, onClose, onSave }: { session: StaySession | null; stayId: string; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    startDate: session?.startDate?.split('T')[0] || '',
    endDate: session?.endDate?.split('T')[0] || '',
    seatsTotal: session?.seatsTotal || 20,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    const url = session ? `/api/admin/stays/${stayId}/sessions/${session.id}` : `/api/admin/stays/${stayId}/sessions`;
    const method = session ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">{session ? 'Modifier' : 'Nouvelle'} session</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date de début</label>
            <input type="date" className="w-full border rounded-lg px-4 py-2" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date de fin</label>
            <input type="date" className="w-full border rounded-lg px-4 py-2" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Places totales</label>
            <input type="number" className="w-full border rounded-lg px-4 py-2" value={form.seatsTotal} onChange={e => setForm({...form, seatsTotal: +e.target.value})} required />
          </div>
          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" className="flex-1">Enregistrer</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

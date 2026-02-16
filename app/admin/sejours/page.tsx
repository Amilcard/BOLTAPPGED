'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS, formatPrice } from '@/lib/utils';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stay } from '@/lib/types';

export default function AdminSejours() {
  const [stays, setStays] = useState<Stay[]>([]);
  const [editingStay, setEditingStay] = useState<Stay | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchStays = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    const res = await fetch('/api/admin/stays', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setStays(await res.json());
  };

  useEffect(() => { fetchStays(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce séjour ?')) return;
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    await fetch(`/api/admin/stays/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchStays();
  };

  const handleTogglePublish = async (stay: Stay) => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    await fetch(`/api/admin/stays/${stay.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !stay.published }),
    });
    fetchStays();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-primary">Séjours</h1>
        <Button onClick={() => setIsCreating(true)}>
          <Plus size={20} className="mr-2" /> Nouveau séjour
        </Button>
      </div>

      {(isCreating || editingStay) && (
        <StayForm
          stay={editingStay}
          onClose={() => { setIsCreating(false); setEditingStay(null); }}
          onSave={() => { fetchStays(); setIsCreating(false); setEditingStay(null); }}
        />
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Titre</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Âges</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Prix</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Statut</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stays.map((stay) => (
              <tr key={stay.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{stay.title}</td>
                <td className="px-6 py-4 text-gray-600">{stay.ageMin}-{stay.ageMax} ans</td>
                <td className="px-6 py-4 text-gray-600">{formatPrice(stay.priceFrom ?? 0)}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${stay.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {stay.published ? 'Publié' : 'Brouillon'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleTogglePublish(stay)} className="p-2 hover:bg-gray-100 rounded" title={stay.published ? 'Dépublier' : 'Publier'}>
                      {stay.published ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button onClick={() => setEditingStay(stay)} className="p-2 hover:bg-gray-100 rounded" title="Modifier">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => handleDelete(stay.id)} className="p-2 hover:bg-red-50 text-red-600 rounded" title="Supprimer">
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

function StayForm({ stay, onClose, onSave }: { stay: Stay | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    title: stay?.title || '',
    descriptionShort: stay?.descriptionShort || '',
    programme: stay?.programme?.join('\n') || '',
    geography: stay?.geography || '',
    accommodation: stay?.accommodation || '',
    supervision: stay?.supervision || '',
    priceFrom: stay?.priceFrom || 0,
    durationDays: stay?.durationDays || 7,
    period: stay?.period || 'ete',
    ageMin: stay?.ageMin || 6,
    ageMax: stay?.ageMax || 12,
    themes: stay?.themes?.join(', ') || '',
    imageCover: stay?.imageCover || '',
    published: stay?.published ?? false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    const body = {
      ...form,
      programme: form.programme.split('\n').filter(Boolean),
      themes: form.themes.split(',').map(t => t.trim()).filter(Boolean),
    };
    const url = stay ? `/api/admin/stays/${stay.id}` : '/api/admin/stays';
    const method = stay ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">{stay ? 'Modifier' : 'Nouveau'} séjour</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input className="w-full border rounded-lg px-4 py-2" placeholder="Titre" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          <textarea className="w-full border rounded-lg px-4 py-2" placeholder="Description courte" rows={2} value={form.descriptionShort} onChange={e => setForm({...form, descriptionShort: e.target.value})} />
          <textarea className="w-full border rounded-lg px-4 py-2" placeholder="Programme (1 ligne par item)" rows={4} value={form.programme} onChange={e => setForm({...form, programme: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <input className="border rounded-lg px-4 py-2" placeholder="Géographie" value={form.geography} onChange={e => setForm({...form, geography: e.target.value})} />
            <input className="border rounded-lg px-4 py-2" placeholder="Hébergement" value={form.accommodation} onChange={e => setForm({...form, accommodation: e.target.value})} />
          </div>
          <input className="w-full border rounded-lg px-4 py-2" placeholder="Encadrement" value={form.supervision} onChange={e => setForm({...form, supervision: e.target.value})} />
          <div className="grid grid-cols-3 gap-4">
            <input type="number" className="border rounded-lg px-4 py-2" placeholder="Prix" value={form.priceFrom} onChange={e => setForm({...form, priceFrom: +e.target.value})} />
            <input type="number" className="border rounded-lg px-4 py-2" placeholder="Durée (jours)" value={form.durationDays} onChange={e => setForm({...form, durationDays: +e.target.value})} />
            <select className="border rounded-lg px-4 py-2" value={form.period} onChange={e => setForm({...form, period: e.target.value})}>
              <option value="printemps">Printemps</option>
              <option value="ete">Été</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input type="number" className="border rounded-lg px-4 py-2" placeholder="Âge min" value={form.ageMin} onChange={e => setForm({...form, ageMin: +e.target.value})} />
            <input type="number" className="border rounded-lg px-4 py-2" placeholder="Âge max" value={form.ageMax} onChange={e => setForm({...form, ageMax: +e.target.value})} />
          </div>
          <input className="w-full border rounded-lg px-4 py-2" placeholder="Thèmes (séparés par virgule)" value={form.themes} onChange={e => setForm({...form, themes: e.target.value})} />
          <input className="w-full border rounded-lg px-4 py-2" placeholder="URL image cover" value={form.imageCover} onChange={e => setForm({...form, imageCover: e.target.value})} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.published} onChange={e => setForm({...form, published: e.target.checked})} />
            Publier immédiatement
          </label>
          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" className="flex-1">Enregistrer</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

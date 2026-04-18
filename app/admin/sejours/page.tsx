'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';
import { Plus, Pencil, Trash2, Eye, EyeOff, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StayWithWaitlist } from '@/lib/types';
import { useAdminUI } from '@/components/admin/admin-ui';

export default function AdminSejours() {
  const router = useRouter();
  const { confirm, toast } = useAdminUI();
  const [stays, setStays] = useState<StayWithWaitlist[]>([]);

  const fetchStays = async () => {
    const res = await fetch('/api/admin/stays');
    if (res.ok) setStays(await res.json());
  };

  useEffect(() => { fetchStays(); }, []);

  const handleDelete = (id: string) => {
    confirm('Supprimer ce séjour ? Cette action est irréversible.', async () => {
      await fetch(`/api/admin/stays/${id}`, {
        method: 'DELETE',
      });
      fetchStays();
    });
  };

  const handleNotifyWaitlist = (stay: StayWithWaitlist) => {
    const count = stay.waitlistCount;
    confirm(`Envoyer un email à ${count} personne(s) en attente pour ce séjour ?`, async () => {
      const res = await fetch('/api/admin/stays/notify-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staySlug: stay.id }),
      });
      if (res.ok) {
        const { sent } = await res.json();
        toast(`${sent} email(s) envoyé(s).`);
        fetchStays();
      }
    });
  };

  const handleTogglePublish = async (stay: StayWithWaitlist) => {
    await fetch(`/api/admin/stays/${stay.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !stay.published }),
    });
    fetchStays();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-primary">Séjours</h1>
        <Button onClick={() => router.push('/admin/sejours/new')}>
          <Plus size={20} className="mr-2" /> Nouveau séjour
        </Button>
      </div>

      <div className="bg-white rounded-brand shadow-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Titre</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Âges</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Prix</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Statut</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Attente</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stays.map((stay) => (
              <tr key={stay.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <span className="font-medium">{stay.title}</span>
                  {stay.rawTitle && stay.rawTitle !== stay.title && (
                    <span className="block text-xs text-gray-400 mt-0.5">{stay.rawTitle}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-600">{stay.ageMin}-{stay.ageMax} ans</td>
                <td className="px-6 py-4 text-gray-600">{formatPrice(stay.priceFrom ?? 0)}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${stay.published ? 'bg-primary-50 text-primary' : 'bg-gray-100 text-gray-600'}`}>
                    {stay.published ? 'Publié' : 'Brouillon'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {stay.waitlistCount && stay.waitlistCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <Bell size={11} /> {stay.waitlistCount}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    {stay.waitlistCount && stay.waitlistCount > 0 && (
                      <button
                        onClick={() => handleNotifyWaitlist(stay)}
                        className="p-2 hover:bg-amber-50 text-amber-600 rounded"
                        title={`Notifier ${stay.waitlistCount} personne(s) en attente`}
                      >
                        <Bell size={18} />
                      </button>
                    )}
                    <button onClick={() => handleTogglePublish(stay)} className="p-2 hover:bg-gray-100 rounded" title={stay.published ? 'Dépublier' : 'Publier'}>
                      {stay.published ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button onClick={() => router.push(`/admin/sejours/${stay.id}/edit`)} className="p-2 hover:bg-gray-100 rounded" title="Modifier">
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

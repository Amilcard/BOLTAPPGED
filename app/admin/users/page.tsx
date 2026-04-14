'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAdminUI } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { getStoredUser } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

const ROLES = ['ADMIN', 'EDITOR', 'VIEWER'];

export default function AdminUsers() {
  const router = useRouter();
  const { confirm } = useAdminUI();
  // Tous les hooks AVANT tout return conditionnel (règle React)
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
  };

  // Guard : ADMIN uniquement — EDITOR/VIEWER redirigés
  const storedUser = getStoredUser();
  const isAdmin = storedUser?.role === 'ADMIN';

  useEffect(() => {
    if (!isAdmin) {
      router.push('/admin');
      return;
    }
    fetchUsers();
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  const handleDelete = (id: string) => {
    confirm('Supprimer cet utilisateur ? Cette action est irréversible.', async () => {
      await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      fetchUsers();
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-primary">Utilisateurs</h1>
        <Button onClick={() => setIsCreating(true)}>
          <Plus size={20} className="mr-2" /> Nouvel utilisateur
        </Button>
      </div>

      {(isCreating || editingUser) && (
        <UserForm
          user={editingUser}
          onClose={() => { setIsCreating(false); setEditingUser(null); }}
          onSave={() => { fetchUsers(); setIsCreating(false); setEditingUser(null); }}
        />
      )}

      <div className="bg-white rounded-brand shadow-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Rôle</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                    user.role === 'EDITOR' ? 'bg-accent/10 text-accent' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingUser(user)} className="p-2 hover:bg-gray-100 rounded">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => handleDelete(user.id)} className="p-2 hover:bg-red-50 text-red-600 rounded">
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

function UserForm({ user, onClose, onSave }: { user: User | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    email: user?.email || '',
    password: '',
    role: user?.role || 'EDITOR',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const url = user ? `/api/admin/users/${user.id}` : '/api/admin/users';
    const method = user ? 'PUT' : 'POST';
    const body = user ? { email: form.email, role: form.role, ...(form.password && { password: form.password }) } : form;
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onSave();
      } else {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data?.error?.message ?? 'Erreur lors de l\'enregistrement.');
      }
    } catch {
      setSubmitError('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogPrimitive.Root open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <DialogPrimitive.Content
          className="fixed inset-0 flex items-center justify-center z-50 p-4 focus:outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            {user ? 'Modifier utilisateur' : 'Nouvel utilisateur'}
          </DialogPrimitive.Title>
          <div className="bg-white rounded-brand shadow-brand-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold" aria-hidden="true">{user ? 'Modifier' : 'Nouvel'} utilisateur</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <input aria-label="Email" className="w-full border rounded-lg px-4 py-2" type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
              <input aria-label={user ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'} className="w-full border rounded-lg px-4 py-2" type="password" placeholder={user ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!user} />
              <select aria-label="Rôle" className="w-full border rounded-lg px-4 py-2" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              {submitError && <p className="text-sm text-red-600" role="alert">{submitError}</p>}
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
                <Button type="submit" disabled={submitting} className="flex-1">{submitting ? 'Envoi...' : 'Enregistrer'}</Button>
              </div>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

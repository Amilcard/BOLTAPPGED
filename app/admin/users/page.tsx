'use client';
export const dynamic = 'force-dynamic';


import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/utils';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

const ROLES = ['ADMIN', 'EDITOR', 'VIEWER'];

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchUsers = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setUsers(await res.json());
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchUsers();
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

      <div className="bg-white rounded-xl shadow overflow-hidden">
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
                    user.role === 'EDITOR' ? 'bg-blue-100 text-blue-700' :
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    const url = user ? `/api/admin/users/${user.id}` : '/api/admin/users';
    const method = user ? 'PUT' : 'POST';
    const body = user ? { email: form.email, role: form.role, ...(form.password && { password: form.password }) } : form;
    await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">{user ? 'Modifier' : 'Nouvel'} utilisateur</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input className="w-full border rounded-lg px-4 py-2" type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <input className="w-full border rounded-lg px-4 py-2" type="password" placeholder={user ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!user} />
          <select className="w-full border rounded-lg px-4 py-2" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            {ROLES.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" className="flex-1">Enregistrer</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

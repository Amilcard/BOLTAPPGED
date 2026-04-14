'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Stay } from '@/lib/types';

export default function EditSejourPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [stay, setStay] = useState<Stay | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    descriptionShort: '',
    programme: '',
    geography: '',
    accommodation: '',
    supervision: '',
    priceFrom: 0,
    durationDays: 7,
    period: 'ete',
    ageMin: 6,
    ageMax: 12,
    themes: '',
    imageCover: '',
    published: false,
  });

  useEffect(() => {
    const fetchStay = async () => {
      try {
        const res = await fetch('/api/admin/stays');
        if (!res.ok) throw new Error('Erreur chargement');
        const stays: Stay[] = await res.json();
        const found = stays.find((s) => s.id === params.id);
        if (!found) {
          setError('Séjour introuvable.');
          setLoading(false);
          return;
        }
        setStay(found);
        setForm({
          title: found.title || '',
          descriptionShort: found.descriptionShort || '',
          programme: (found.programme as string[])?.join('\n') || '',
          geography: found.geography || '',
          accommodation: found.accommodation || '',
          supervision: found.supervision || '',
          priceFrom: found.priceFrom || 0,
          durationDays: found.durationDays || 7,
          period: found.period || 'ete',
          ageMin: found.ageMin || 6,
          ageMax: found.ageMax || 12,
          themes: (found.themes as string[])?.join(', ') || '',
          imageCover: found.imageCover || '',
          published: found.published ?? false,
        });
      } catch {
        setError('Impossible de charger le séjour.');
      } finally {
        setLoading(false);
      }
    };
    fetchStay();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        ...form,
        programme: form.programme.split('\n').filter(Boolean),
        themes: form.themes.split(',').map((t) => t.trim()).filter(Boolean),
      };
      const res = await fetch(`/api/admin/stays/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Erreur sauvegarde');
      router.push('/admin/sejours');
    } catch {
      setError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card className="rounded-brand shadow-card">
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !stay) {
    return (
      <div>
        <Button variant="ghost" onClick={() => router.push('/admin/sejours')} className="mb-4">
          <ArrowLeft size={18} className="mr-2" /> Retour
        </Button>
        <div role="alert" className="text-destructive bg-destructive/10 rounded-brand p-4">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" onClick={() => router.push('/admin/sejours')} className="mb-4">
        <ArrowLeft size={18} className="mr-2" /> Retour aux séjours
      </Button>

      <h1 className="text-2xl font-bold text-primary mb-6">Modifier le séjour</h1>

      {error && (
        <div role="alert" className="text-destructive bg-destructive/10 rounded-brand p-4 mb-4">
          {error}
        </div>
      )}

      <Card className="rounded-brand shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Informations du séjour</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Titre</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>

            <div>
              <Label htmlFor="descriptionShort">Description courte</Label>
              <Textarea id="descriptionShort" rows={2} value={form.descriptionShort} onChange={(e) => setForm({ ...form, descriptionShort: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="programme">Programme (1 ligne par item)</Label>
              <Textarea id="programme" rows={4} value={form.programme} onChange={(e) => setForm({ ...form, programme: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="geography">Géographie</Label>
                <Input id="geography" value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="accommodation">Hébergement</Label>
                <Input id="accommodation" value={form.accommodation} onChange={(e) => setForm({ ...form, accommodation: e.target.value })} />
              </div>
            </div>

            <div>
              <Label htmlFor="supervision">Encadrement</Label>
              <Input id="supervision" value={form.supervision} onChange={(e) => setForm({ ...form, supervision: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="priceFrom">Prix (EUR)</Label>
                <Input id="priceFrom" type="number" value={form.priceFrom} onChange={(e) => setForm({ ...form, priceFrom: +e.target.value })} />
              </div>
              <div>
                <Label htmlFor="durationDays">Durée (jours)</Label>
                <Input id="durationDays" type="number" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: +e.target.value })} />
              </div>
              <div>
                <Label htmlFor="period">Période</Label>
                <Select value={form.period} onValueChange={(val) => setForm({ ...form, period: val })}>
                  <SelectTrigger id="period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="printemps">Printemps</SelectItem>
                    <SelectItem value="ete">Été</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ageMin">Âge minimum</Label>
                <Input id="ageMin" type="number" value={form.ageMin} onChange={(e) => setForm({ ...form, ageMin: +e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ageMax">Âge maximum</Label>
                <Input id="ageMax" type="number" value={form.ageMax} onChange={(e) => setForm({ ...form, ageMax: +e.target.value })} />
              </div>
            </div>

            <div>
              <Label htmlFor="themes">Thèmes (séparés par virgule)</Label>
              <Input id="themes" value={form.themes} onChange={(e) => setForm({ ...form, themes: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="imageCover">URL image cover</Label>
              <Input id="imageCover" value={form.imageCover} onChange={(e) => setForm({ ...form, imageCover: e.target.value })} />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="published"
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="published" className="cursor-pointer">Publier immédiatement</Label>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => router.push('/admin/sejours')} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

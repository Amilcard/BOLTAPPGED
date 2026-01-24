'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Trash2, Share2, ArrowLeft, MapPin, Clock, Users, Edit3, Check, X } from 'lucide-react';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { useApp } from '@/components/providers';
import { clearWishlist, getWishlistItems, updateWishlistMotivation, type WishlistItem } from '@/lib/utils';
import type { Stay } from '@/lib/types';

export default function EnviesPage() {
  const { wishlist, toggleWishlist, mounted, mode } = useApp();
  const [stays, setStays] = useState<Stay[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editMotivation, setEditMotivation] = useState('');

  useEffect(() => {
    if (!mounted) return;
    setWishlistItems(getWishlistItems());
    
    const fetchStays = async () => {
      try {
        const res = await fetch('/api/stays');
        if (res.ok) {
          const allStays = await res.json();
          setStays(allStays);
        }
      } catch (err) {
        console.error('Fetch stays error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStays();
  }, [mounted, wishlist]);

  const wishlistStays = stays.filter((s) => wishlist.includes(s.slug));

  const getMotivation = (slug: string): string | null => {
    return wishlistItems.find(i => i.stayId === slug)?.motivation ?? null;
  };

  const handleClearAll = () => {
    if (confirm('Vider toute la liste ?')) {
      clearWishlist();
      window.location.reload();
    }
  };

  const handleStartEdit = (slug: string) => {
    setEditingSlug(slug);
    setEditMotivation(getMotivation(slug) || '');
  };

  const handleSaveMotivation = (slug: string) => {
    updateWishlistMotivation(slug, editMotivation.trim() || null);
    setWishlistItems(getWishlistItems());
    setEditingSlug(null);
    setEditMotivation('');
  };

  const handleShareList = async () => {
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    const items = wishlistStays.map((s) => {
      const motivation = getMotivation(s.slug);
      return motivation ? `• ${s.title}\n  Pourquoi : ${motivation}` : `• ${s.title}`;
    }).join('\n');
    const text = `Mes souhaits de séjours :\n${items}\n\nDécouvre le catalogue : ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mes souhaits de séjours', text });
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch {
        window.location.href = `mailto:?subject=${encodeURIComponent('Mes souhaits de séjours')}&body=${encodeURIComponent(text)}`;
      }
    }
  };

  const handleShareSingle = async (stay: Stay) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/sejour/${stay.slug}`;
    const motivation = getMotivation(stay.slug);
    const text = motivation
      ? `Ce séjour m'intéresse : ${stay.title}\nPourquoi : ${motivation}\n${url}`
      : `Ce séjour m'intéresse : ${stay.title}\n${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: stay.title, text });
      } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch { /* fallback */ }
    }
  };

  const isKids = mode === 'kids';

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-1 text-primary-500 text-sm mb-2 hover:text-primary">
              <ArrowLeft className="w-4 h-4" /> Retour
            </Link>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Heart className="w-6 h-6 text-red-500 fill-current" />
              {isKids ? 'Mes souhaits' : 'Ma sélection'}
            </h1>
            {wishlistStays.length > 0 && (
              <p className="text-sm text-primary-500 mt-1">
                {wishlistStays.length} séjour{wishlistStays.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {wishlistStays.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleShareList}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Partager</span>
              </button>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Vider</span>
              </button>
            </div>
          )}
        </div>

        {/* Share success toast */}
        {shareSuccess && (
          <div className="mb-4 px-4 py-3 bg-green-100 text-green-700 rounded-lg text-sm text-center">
            Liste copiée dans le presse-papier !
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-16 text-primary-400">Chargement...</div>
        ) : wishlistStays.length === 0 ? (
          <div className="text-center py-16 bg-primary-50/50 rounded-xl">
            <Heart className="w-16 h-16 text-primary-200 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-primary mb-2">
              {isKids ? 'Aucun souhait pour l\'instant' : 'Aucun séjour sélectionné'}
            </h2>
            <p className="text-primary-500 mb-6">
              {isKids
                ? 'Ajoute des séjours à ta liste en cliquant sur le cœur !'
                : 'Parcourez le catalogue et ajoutez des séjours à votre sélection.'}
            </p>
            <Link
              href="/#sejours"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition"
            >
              {isKids ? 'Découvrir les séjours' : 'Voir le catalogue'}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {wishlistStays.map((stay) => {
              const motivation = getMotivation(stay.slug);
              const isEditing = editingSlug === stay.slug;
              
              return (
                <article
                  key={stay.id}
                  className="bg-white rounded-xl shadow-card overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row">
                    <Link href={`/sejour/${stay.slug}`} className="relative sm:w-48 aspect-video sm:aspect-square shrink-0">
                      <Image
                        src={stay.imageCover ?? '/og-image.png'}
                        alt={stay.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 200px"
                      />
                    </Link>
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <Link href={`/sejour/${stay.slug}`}>
                          <h3 className="font-semibold text-primary text-lg hover:text-accent transition">
                            {stay.title}
                          </h3>
                        </Link>
                        <p className="text-sm text-primary-600 mt-1 line-clamp-2">
                          {stay.descriptionShort}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-3 text-xs text-primary-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {stay.ageMin}-{stay.ageMax} ans
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {stay.durationDays} jours
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {stay.geography}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-primary-100">
                        <div className="flex gap-2">
                          <Link
                            href={`/sejour/${stay.slug}`}
                            className="text-accent text-sm font-medium hover:underline"
                          >
                            {isKids ? 'Découvrir →' : 'Voir le détail →'}
                          </Link>
                          <button
                            onClick={() => handleShareSingle(stay)}
                            className="flex items-center gap-1 px-2 py-1 text-primary-500 hover:bg-primary-50 rounded-lg text-sm transition"
                            title="Partager"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => toggleWishlist(stay.slug)}
                          className="flex items-center gap-1 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-sm transition"
                        >
                          <Heart className="w-4 h-4 fill-current" />
                          Retirer
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Motivation section */}
                  <div className="px-4 pb-4 border-t border-primary-50 pt-3 bg-primary-50/30">
                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-primary-600">
                          Pourquoi ce séjour t&apos;intéresse ?
                        </label>
                        <textarea
                          value={editMotivation}
                          onChange={(e) => setEditMotivation(e.target.value.slice(0, 280))}
                          placeholder="Ex: J'ai envie d'apprendre…"
                          className="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                          rows={2}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-primary-400">{editMotivation.length}/280</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingSlug(null)}
                              className="p-2 text-primary-400 hover:bg-white rounded-lg transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSaveMotivation(stay.slug)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        {motivation ? (
                          <div className="flex-1">
                            <span className="text-xs font-medium text-primary-500">Pourquoi : </span>
                            <span className="text-sm text-primary-600">{motivation}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-primary-400 italic">
                            {isKids ? 'Dis-nous pourquoi ce séjour t\'intéresse !' : 'Ajouter une note'}
                          </span>
                        )}
                        <button
                          onClick={() => handleStartEdit(stay.slug)}
                          className="flex items-center gap-1 px-2 py-1 text-primary-500 hover:bg-white rounded-lg text-xs transition shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {motivation ? 'Modifier' : 'Ajouter'}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

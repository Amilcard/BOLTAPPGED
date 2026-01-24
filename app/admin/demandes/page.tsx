'use client';

import { useEffect, useState } from 'react';
import { STORAGE_KEYS, formatDate } from '@/lib/utils';
import { Eye } from 'lucide-react';
import { Booking } from '@/lib/types';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nouvelle', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_review', label: 'En cours', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'accepted', label: 'Acceptée', color: 'bg-green-100 text-green-700' },
  { value: 'refused', label: 'Refusée', color: 'bg-red-100 text-red-700' },
];

export default function AdminDemandes() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    const res = await fetch('/api/admin/bookings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setBookings(await res.json());
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleStatusChange = async (id: string, status: string) => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);
    await fetch(`/api/admin/bookings/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchBookings();
  };

  const getStatusStyle = (status: string) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-8">Demandes de réservation</h1>

      {selectedBooking && (
        <BookingDetail booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Enfant</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Organisation</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Statut</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.map((booking) => {
              const statusStyle = getStatusStyle(booking.status);
              return (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{formatDate(booking.createdAt)}</td>
                  <td className="px-6 py-4 font-medium">{booking.childFirstName} {booking.childLastName}</td>
                  <td className="px-6 py-4 text-gray-600">{booking.organisation}</td>
                  <td className="px-6 py-4 text-gray-600">{booking.email}</td>
                  <td className="px-6 py-4">
                    <select
                      className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle.color}`}
                      value={booking.status}
                      onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end">
                      <button onClick={() => setSelectedBooking(booking)} className="p-2 hover:bg-gray-100 rounded" title="Détails">
                        <Eye size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingDetail({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Détail de la demande</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-primary mb-2">Travailleur social</h3>
            <p><strong>Nom :</strong> {booking.socialWorkerName}</p>
            <p><strong>Organisation :</strong> {booking.organisation}</p>
            <p><strong>Email :</strong> {booking.email}</p>
            <p><strong>Téléphone :</strong> {booking.phone}</p>
          </div>
          <div>
            <h3 className="font-semibold text-primary mb-2">Enfant</h3>
            <p><strong>Prénom :</strong> {booking.childFirstName}</p>
            {booking.childLastName && <p><strong>Nom :</strong> {booking.childLastName}</p>}
            <p><strong>Date de naissance :</strong> {booking.childBirthDate ? formatDate(booking.childBirthDate) : '-'}</p>
          </div>
          {(booking.notes || booking.childNotes) && (
            <div>
              <h3 className="font-semibold text-primary mb-2">Notes</h3>
              {booking.notes && <p><strong>Général :</strong> {booking.notes}</p>}
              {booking.childNotes && <p><strong>Enfant :</strong> {booking.childNotes}</p>}
            </div>
          )}
          <p className="text-sm text-gray-500">Créée le {formatDate(booking.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { bookingsService, BookingsQuery } from '../../services/bookings.service';
import { BookingWithDetails, PaginatedResponse } from '../../types/admin.types';

export default function BookingsList() {
  const [bookings, setBookings] = useState<PaginatedResponse<BookingWithDetails> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState<BookingsQuery>({
    page: 1,
    limit: 20,
    status: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await bookingsService.getBookings(query);
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadBookings, 30000);
    return () => clearInterval(interval);
  }, [query]);

  const handleStatusFilter = (status: string) => {
    setQuery(prev => ({ ...prev, status: status as any, page: 1 }));
  };

  const handleDateFilter = (days: number) => {
    const dateTo = new Date().toISOString();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    
    setQuery(prev => ({ 
      ...prev, 
      dateFrom: dateFrom.toISOString(),
      dateTo,
      page: 1 
    }));
  };

  const handleCancelBooking = async (bookingId: string) => {
    const reason = window.prompt('Raison de l\'annulation:');
    if (!reason) return;

    try {
      await bookingsService.cancelBooking(bookingId, reason);
      loadBookings(); // Reload data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'annulation');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">⏳ En attente</span>,
      ACCEPTED: <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">✓ Acceptée</span>,
      COMPLETED: <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">✅ Terminée</span>,
      CANCELLED: <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">❌ Annulée</span>,
      REJECTED: <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">⚫ Rejetée</span>
    };
    
    return badges[status as keyof typeof badges] || status;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return `${amount.toLocaleString('fr-FR')} FC`;
  };

  if (loading && !bookings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-gray-600">Chargement des réservations...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Réservations</h1>
          <p className="text-gray-600">Gérer les réservations et courses en temps réel</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          Auto-refresh 30s
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col gap-4">
          {/* Status Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <div className="flex flex-wrap gap-2">
              {['all', 'PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusFilter(status)}
                  className={`px-3 py-2 text-sm rounded-md ${
                    query.status === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {status === 'all' && 'Toutes'}
                  {status === 'PENDING' && 'En attente'}
                  {status === 'ACCEPTED' && 'Acceptées'}
                  {status === 'COMPLETED' && 'Terminées'}
                  {status === 'CANCELLED' && 'Annulées'}
                </button>
              ))}
            </div>
          </div>

          {/* Date Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Période</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleDateFilter(1)}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => handleDateFilter(7)}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md"
              >
                7 derniers jours
              </button>
              <button
                onClick={() => handleDateFilter(30)}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md"
              >
                30 derniers jours
              </button>
              <button
                onClick={() => setQuery(prev => ({ ...prev, dateFrom: undefined, dateTo: undefined, page: 1 }))}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md"
              >
                Toutes les dates
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Bookings Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Réservation</th>
                <th>Client</th>
                <th>Chauffeur</th>
                <th>Trajet</th>
                <th>Statut</th>
                <th>Montant</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings?.data.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <div>
                      <div className="font-mono text-sm text-gray-500">
                        #{booking.id.slice(-8)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDateTime(booking.createdAt)}
                      </div>
                      <div className="text-xs text-gray-400">
                        RDV: {formatDateTime(booking.pickupTime)}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div className="font-medium text-gray-900">{booking.customer.name}</div>
                      <div className="text-sm text-gray-500">{booking.customer.phoneNumber}</div>
                      <div className="flex items-center text-xs text-gray-400">
                        <span className="text-yellow-400">⭐</span>
                        <span className="ml-1">{booking.customer.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {booking.driver ? (
                      <div>
                        <div className="font-medium text-gray-900">{booking.driver.name}</div>
                        <div className="text-sm text-gray-500">{booking.driver.phoneNumber}</div>
                        <div className="text-xs text-gray-400">
                          {booking.driver.vehicleType} - {booking.driver.vehiclePlate}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Non assigné</span>
                    )}
                  </td>
                  <td>
                    <div>
                      <div className="text-sm">
                        <span className="text-green-600">📍 </span>
                        {booking.pickupAddress}
                      </div>
                      <div className="text-sm">
                        <span className="text-red-600">📍 </span>
                        {booking.dropAddress}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {booking.passengers} passager{booking.passengers > 1 ? 's' : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    {getStatusBadge(booking.status)}
                  </td>
                  <td>
                    <div>
                      {booking.trip?.fare ? (
                        <div>
                          <div className="font-medium">{formatCurrency(booking.trip.fare)}</div>
                          <div className="text-xs text-gray-500">
                            {booking.trip.paymentStatus === 'COMPLETED' ? '✓ Payé' : 
                             booking.trip.paymentStatus === 'PENDING' ? '⏳ En attente' : 
                             'Non payé'}
                          </div>
                        </div>
                      ) : booking.estimatedFare ? (
                        <div className="text-gray-500">
                          ~{formatCurrency(booking.estimatedFare)}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => alert('Détails à implémenter')}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Voir
                      </button>
                      {(booking.status === 'PENDING' || booking.status === 'ACCEPTED') && (
                        <button
                          onClick={() => handleCancelBooking(booking.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {bookings && bookings.pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Affichage de {((bookings.pagination.page - 1) * bookings.pagination.limit) + 1} à{' '}
                {Math.min(bookings.pagination.page * bookings.pagination.limit, bookings.pagination.total)} sur{' '}
                {bookings.pagination.total} réservations
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setQuery(prev => ({ ...prev, page: prev.page! - 1 }))}
                  disabled={bookings.pagination.page <= 1}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setQuery(prev => ({ ...prev, page: prev.page! + 1 }))}
                  disabled={bookings.pagination.page >= bookings.pagination.totalPages}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {bookings?.data.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📋</div>
          <p className="text-gray-500 text-lg">Aucune réservation trouvée</p>
          <p className="text-gray-400 text-sm">Les nouvelles réservations apparaîtront ici automatiquement</p>
        </div>
      )}
    </div>
  );
}
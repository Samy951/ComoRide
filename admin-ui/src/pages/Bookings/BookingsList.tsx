import { useState, useEffect } from 'react';
import { 
  Filter, 
  Clock,
  Car,
  Calendar,
  Eye,
  XCircle,
  CheckCircle,
  Activity,
  Phone,
  Star,
  Route,
  Users,
  AlertCircle,
  RefreshCw,
  Banknote
} from 'lucide-react';
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
      loadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'annulation');
    }
  };

  const getStatusInfo = (status: string) => {
    const statusConfig = {
      PENDING: { 
        label: 'En attente', 
        icon: Clock, 
        className: 'badge-warning',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800'
      },
      ACCEPTED: { 
        label: 'Acceptée', 
        icon: CheckCircle, 
        className: 'badge-primary',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800'
      },
      COMPLETED: { 
        label: 'Terminée', 
        icon: CheckCircle, 
        className: 'badge-success',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800'
      },
      CANCELLED: { 
        label: 'Annulée', 
        icon: XCircle, 
        className: 'badge-danger',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800'
      },
      REJECTED: { 
        label: 'Rejetée', 
        icon: XCircle, 
        className: 'badge-secondary',
        bgColor: 'bg-gray-50 dark:bg-gray-800/50',
        borderColor: 'border-gray-200 dark:border-gray-700'
      }
    };
    
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('fr-FR'),
      time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return `${amount.toLocaleString('fr-FR')} FC`;
  };

  const getCustomerAvatar = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  if (loading && !bookings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">Chargement des réservations...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Synchronisation en temps réel</p>
        </div>
      </div>
    );
  }

  const BookingCard = ({ booking }: { booking: BookingWithDetails }) => {
    const statusInfo = getStatusInfo(booking.status);
    const created = formatDateTime(booking.createdAt);
    const pickup = formatDateTime(booking.pickupTime);
    const StatusIcon = statusInfo.icon;

    return (
      <div className={`card hover:shadow-xl transition-all duration-300 border-l-4 ${statusInfo.borderColor} ${statusInfo.bgColor}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shadow-lg">
                #{booking.id.slice(-4)}
              </div>
              <div>
                <div className="font-mono text-sm text-gray-500 dark:text-gray-400">
                  Réservation #{booking.id.slice(-8)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Créée le {created.date} à {created.time}
                </div>
              </div>
            </div>
            
            <div className={`badge ${statusInfo.className} flex items-center gap-2`}>
              <StatusIcon className="w-4 h-4" />
              {statusInfo.label}
            </div>
          </div>

          {/* Client et Chauffeur */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Client */}
            <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-sm">
                  {getCustomerAvatar(booking.customer.name)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{booking.customer.name}</div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Phone className="w-3 h-3" />
                    <span className="text-sm">{booking.customer.phoneNumber}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">{booking.customer.rating.toFixed(1)}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Client</div>
              </div>
            </div>

            {/* Chauffeur */}
            <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4">
              {booking.driver ? (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                      {getCustomerAvatar(booking.driver.name)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{booking.driver.name}</div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Car className="w-3 h-3" />
                        <span className="text-sm">{booking.driver.vehicleType}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
                      {booking.driver.vehiclePlate}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Chauffeur</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400 dark:text-gray-600">
                    <Car className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <span className="text-sm">Non assigné</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Itinéraire */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/30 dark:to-gray-700/30 rounded-xl p-4 mb-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Départ</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{booking.pickupAddress}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 ml-1">
                <div className="w-1 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">RDV: {pickup.date} à {pickup.time}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Destination</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{booking.dropAddress}</div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {booking.passengers} passager{booking.passengers > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Course</span>
              </div>
            </div>
          </div>

          {/* Prix et Statut de paiement */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-xl">
                <Banknote className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {booking.trip?.fare ? formatCurrency(booking.trip.fare) : 
                   booking.estimatedFare ? `~${formatCurrency(booking.estimatedFare)}` : 
                   'Non défini'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {booking.trip?.paymentStatus === 'COMPLETED' ? '✅ Payé' : 
                   booking.trip?.paymentStatus === 'PENDING' ? '⏳ En attente' : 
                   'Non payé'}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => alert('Détails à implémenter')}
              className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Voir détails
            </button>
            
            {(booking.status === 'PENDING' || booking.status === 'ACCEPTED') && (
              <button
                onClick={() => handleCancelBooking(booking.id)}
                className="btn btn-danger flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Annuler
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header moderne */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            Réservations
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérer les réservations et courses en temps réel</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full text-sm">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Auto-refresh 30s</span>
          </div>
          
          <button
            onClick={loadBookings}
            disabled={loading}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="card p-6">
        <div className="space-y-4">
          {/* Filtres de statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Statut</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Toutes', icon: Filter },
                { key: 'PENDING', label: 'En attente', icon: Clock },
                { key: 'ACCEPTED', label: 'Acceptées', icon: CheckCircle },
                { key: 'COMPLETED', label: 'Terminées', icon: CheckCircle },
                { key: 'CANCELLED', label: 'Annulées', icon: XCircle }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleStatusFilter(key)}
                  className={`btn flex items-center gap-2 ${
                    query.status === key ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtres de période */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Période</label>
            <div className="flex flex-wrap gap-2">
              {[
                { days: 0, label: "Aujourd'hui", icon: Calendar },
                { days: 7, label: '7 derniers jours', icon: Calendar },
                { days: 30, label: '30 derniers jours', icon: Calendar },
                { days: -1, label: 'Toutes les dates', icon: Calendar }
              ].map(({ days, label, icon: Icon }) => (
                <button
                  key={days}
                  onClick={() => days === -1 ? 
                    setQuery(prev => ({ ...prev, dateFrom: undefined, dateTo: undefined, page: 1 })) :
                    handleDateFilter(days === 0 ? 1 : days)
                  }
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="notification-error">
          <AlertCircle className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">Erreur de chargement</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Liste des réservations */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {bookings?.data.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>

      {/* État vide */}
      {bookings?.data.length === 0 && !loading && (
        <div className="empty-state">
          <Calendar className="empty-state-icon" />
          <h3 className="empty-state-title">Aucune réservation trouvée</h3>
          <p className="empty-state-description">
            Aucune réservation ne correspond à vos critères de recherche.
            Les nouvelles réservations apparaîtront ici automatiquement.
          </p>
        </div>
      )}

      {/* Pagination */}
      {bookings && bookings.pagination.totalPages > 1 && (
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">
                {((bookings.pagination.page - 1) * bookings.pagination.limit) + 1}-
                {Math.min(bookings.pagination.page * bookings.pagination.limit, bookings.pagination.total)}
              </span>
              {' '}sur{' '}
              <span className="font-medium">{bookings.pagination.total}</span>
              {' '}réservations
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
  );
}
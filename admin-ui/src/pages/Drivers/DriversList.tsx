import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Filter, 
  MapPin, 
  Star, 
  Car,
  Phone,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  UserCheck,
  UserX,
  Activity,
  TrendingUp,
  Grid3X3,
  List
} from 'lucide-react';
import { driversService, DriversQuery } from '../../services/drivers.service';
import { DriverWithStats, PaginatedResponse } from '../../types/admin.types';

export default function DriversList() {
  const [drivers, setDrivers] = useState<PaginatedResponse<DriverWithStats> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState<DriversQuery>({
    page: 1,
    limit: 20,
    status: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const data = await driversService.getDrivers(query);
      setDrivers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, [query]);

  const handleStatusFilter = (status: string) => {
    setQuery(prev => ({ ...prev, status: status as any, page: 1 }));
  };

  const handleSearch = (search: string) => {
    setQuery(prev => ({ ...prev, search, page: 1 }));
  };

  const handleVerifyDriver = async (id: string, isVerified: boolean) => {
    try {
      await driversService.verifyDriver(id, isVerified);
      loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la vérification');
    }
  };

  const handleActivateDriver = async (id: string, isActive: boolean) => {
    try {
      await driversService.activateDriver(id, isActive);
      loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'activation');
    }
  };

  const getDriverAvatar = (name: string) => {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2);
    return initials.toUpperCase();
  };

  const getVehicleIcon = (vehicleType: string) => {
    if (vehicleType.toLowerCase().includes('suv')) return '🚙';
    if (vehicleType.toLowerCase().includes('sedan')) return '🚗';
    if (vehicleType.toLowerCase().includes('minibus')) return '🚐';
    return '🚗';
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600 dark:text-green-400';
    if (rating >= 4.0) return 'text-yellow-600 dark:text-yellow-400';
    if (rating >= 3.5) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading && !drivers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">Chargement des chauffeurs...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Récupération des profils</p>
        </div>
      </div>
    );
  }

  const DriverCard = ({ driver }: { driver: DriverWithStats }) => (
    <div className="card hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
      <div className="p-6">
        {/* Header avec avatar et statut */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {getDriverAvatar(driver.name)}
              </div>
              {driver.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {driver.name}
              </h3>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Phone className="w-4 h-4" />
                <span className="text-sm">{driver.phoneNumber}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500 mt-1">
                <Shield className="w-4 h-4" />
                <span className="text-xs font-mono">#{driver.licenseNumber}</span>
              </div>
            </div>
          </div>
          
          {/* Badges de statut */}
          <div className="flex flex-col gap-2">
            {driver.isVerified ? (
              <div className="badge badge-success flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Vérifié
              </div>
            ) : (
              <div className="badge badge-warning flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Non vérifié
              </div>
            )}
            
            {driver.isOnline && (
              <div className="badge badge-primary flex items-center gap-1">
                <Activity className="w-3 h-3" />
                En ligne
              </div>
            )}
            
            {!driver.isActive && (
              <div className="badge badge-danger flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Désactivé
              </div>
            )}
          </div>
        </div>

        {/* Véhicule */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getVehicleIcon(driver.vehicleType)}</span>
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">{driver.vehicleType}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{driver.vehiclePlate}</div>
            </div>
          </div>
        </div>

        {/* Zones et rating */}
        <div className="space-y-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Zones d'activité</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {driver.zones.slice(0, 3).map((zone) => (
                <span key={zone} className="px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                  {zone}
                </span>
              ))}
              {driver.zones.length > 3 && (
                <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
                  +{driver.zones.length - 3}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Star className={`w-4 h-4 ${getRatingColor(driver.rating)}`} />
                <span className={`font-bold ${getRatingColor(driver.rating)}`}>
                  {driver.rating.toFixed(1)}
                </span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Rating</div>
            </div>
            
            <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {driver.completedTrips}
                </span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Courses</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            to={`/drivers/${driver.id}`}
            className="btn btn-ghost flex-1 flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Voir
          </Link>
          
          {!driver.isVerified ? (
            <button
              onClick={() => handleVerifyDriver(driver.id, true)}
              className="btn btn-success flex-1 flex items-center justify-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              Vérifier
            </button>
          ) : (
            <button
              onClick={() => handleVerifyDriver(driver.id, false)}
              className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <UserX className="w-4 h-4" />
              Retirer
            </button>
          )}
          
          {driver.isActive ? (
            <button
              onClick={() => handleActivateDriver(driver.id, false)}
              className="btn btn-danger flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => handleActivateDriver(driver.id, true)}
              className="btn btn-success flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header moderne */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            Chauffeurs
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérer les chauffeurs et leurs vérifications</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 rounded-full text-sm">
            <Activity className="w-4 h-4" />
            <span>{drivers?.data.filter(d => d.isOnline).length || 0} en ligne</span>
          </div>
          
          <Link
            to="/drivers/new"
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouveau chauffeur
          </Link>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher par nom ou téléphone..."
                className="input pl-10 w-full"
                value={query.search || ''}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>
          
          {/* Filtres */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Tous', icon: Filter },
              { key: 'verified', label: 'Vérifiés', icon: CheckCircle },
              { key: 'unverified', label: 'Non vérifiés', icon: Clock },
              { key: 'active', label: 'Actifs', icon: Activity },
              { key: 'inactive', label: 'Inactifs', icon: XCircle }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleStatusFilter(key)}
                className={`btn flex items-center gap-2 ${
                  query.status === key
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          
          {/* Toggle view */}
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="notification-error">
          <XCircle className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">Erreur de chargement</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Liste des chauffeurs */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {drivers?.data.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {drivers?.data.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}

      {/* État vide */}
      {drivers?.data.length === 0 && !loading && (
        <div className="empty-state">
          <Car className="empty-state-icon" />
          <h3 className="empty-state-title">Aucun chauffeur trouvé</h3>
          <p className="empty-state-description">
            Aucun chauffeur ne correspond à vos critères de recherche. 
            Essayez de modifier les filtres ou ajoutez un nouveau chauffeur.
          </p>
          <Link to="/drivers/new" className="btn btn-primary mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un chauffeur
          </Link>
        </div>
      )}

      {/* Pagination */}
      {drivers && drivers.pagination.totalPages > 1 && (
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">
                {((drivers.pagination.page - 1) * drivers.pagination.limit) + 1}-
                {Math.min(drivers.pagination.page * drivers.pagination.limit, drivers.pagination.total)}
              </span>
              {' '}sur{' '}
              <span className="font-medium">{drivers.pagination.total}</span>
              {' '}chauffeurs
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setQuery(prev => ({ ...prev, page: prev.page! - 1 }))}
                disabled={drivers.pagination.page <= 1}
                className="btn btn-secondary disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setQuery(prev => ({ ...prev, page: prev.page! + 1 }))}
                disabled={drivers.pagination.page >= drivers.pagination.totalPages}
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
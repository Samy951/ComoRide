import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { driversService, DriversQuery } from '../../services/drivers.service';
import { DriverWithStats, PaginatedResponse } from '../../types/admin.types';

export default function DriversList() {
  const [drivers, setDrivers] = useState<PaginatedResponse<DriverWithStats> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
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
      loadDrivers(); // Reload data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la vérification');
    }
  };

  const handleActivateDriver = async (id: string, isActive: boolean) => {
    try {
      await driversService.activateDriver(id, isActive);
      loadDrivers(); // Reload data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'activation');
    }
  };

  const getStatusBadge = (driver: DriverWithStats) => {
    const badges = [];
    
    if (driver.isVerified) {
      badges.push(<span key="verified" className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">✓ Vérifié</span>);
    } else {
      badges.push(<span key="unverified" className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">⏳ Non vérifié</span>);
    }
    
    if (driver.isOnline) {
      badges.push(<span key="online" className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">🟢 En ligne</span>);
    }
    
    if (!driver.isActive) {
      badges.push(<span key="inactive" className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">❌ Désactivé</span>);
    }
    
    return badges;
  };

  if (loading && !drivers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-gray-600">Chargement des chauffeurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chauffeurs</h1>
          <p className="text-gray-600">Gérer les chauffeurs et leurs vérifications</p>
        </div>
        <Link
          to="/admin/drivers/new"
          className="btn btn-primary"
        >
          ➕ Nouveau chauffeur
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher par nom ou téléphone..."
              className="input w-full"
              value={query.search || ''}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {['all', 'verified', 'unverified', 'active', 'inactive'].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                className={`px-3 py-2 text-sm rounded-md ${
                  query.status === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status === 'all' && 'Tous'}
                {status === 'verified' && 'Vérifiés'}
                {status === 'unverified' && 'Non vérifiés'}
                {status === 'active' && 'Actifs'}
                {status === 'inactive' && 'Inactifs'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Drivers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Chauffeur</th>
                <th>Véhicule</th>
                <th>Zones</th>
                <th>Statut</th>
                <th>Rating</th>
                <th>Courses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers?.data.map((driver) => (
                <tr key={driver.id}>
                  <td>
                    <div>
                      <div className="font-medium text-gray-900">{driver.name}</div>
                      <div className="text-sm text-gray-500">{driver.phoneNumber}</div>
                      <div className="text-xs text-gray-400">#{driver.licenseNumber}</div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div className="font-medium">{driver.vehicleType}</div>
                      <div className="text-sm text-gray-500">{driver.vehiclePlate}</div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {driver.zones.slice(0, 2).map((zone) => (
                        <span key={zone} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          {zone}
                        </span>
                      ))}
                      {driver.zones.length > 2 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          +{driver.zones.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(driver)}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center">
                      <span className="text-yellow-400">⭐</span>
                      <span className="ml-1 font-medium">{driver.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div className="font-medium">{driver.completedTrips}</div>
                      <div className="text-sm text-gray-500">sur {driver.totalTrips}</div>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/drivers/${driver.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Voir
                      </Link>
                      {!driver.isVerified && (
                        <button
                          onClick={() => handleVerifyDriver(driver.id, true)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Vérifier
                        </button>
                      )}
                      {driver.isVerified && (
                        <button
                          onClick={() => handleVerifyDriver(driver.id, false)}
                          className="text-yellow-600 hover:text-yellow-800 text-sm"
                        >
                          Retirer
                        </button>
                      )}
                      {driver.isActive ? (
                        <button
                          onClick={() => handleActivateDriver(driver.id, false)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Désactiver
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivateDriver(driver.id, true)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Activer
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
        {drivers && drivers.pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Affichage de {((drivers.pagination.page - 1) * drivers.pagination.limit) + 1} à{' '}
                {Math.min(drivers.pagination.page * drivers.pagination.limit, drivers.pagination.total)} sur{' '}
                {drivers.pagination.total} chauffeurs
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

      {drivers?.data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucun chauffeur trouvé</p>
        </div>
      )}
    </div>
  );
}
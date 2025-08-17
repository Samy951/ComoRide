import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { driversService } from '../../services/drivers.service';
import { DriverFormData } from '../../types/admin.types';

const driverSchema = z.object({
  phoneNumber: z.string()
    .regex(/^\+269\d{7}$/, "Format téléphone invalide (+269XXXXXXX)"),
  name: z.string()
    .min(2, "Nom doit contenir au moins 2 caractères")
    .max(50, "Nom ne peut pas dépasser 50 caractères"),
  licenseNumber: z.string()
    .min(5, "Numéro de permis invalide")
    .max(20, "Numéro de permis trop long"),
  vehicleType: z.enum(["SEDAN", "SUV", "MOTORCYCLE", "VAN"], {
    message: "Type de véhicule invalide"
  }),
  vehiclePlate: z.string()
    .min(3, "Plaque d'immatriculation invalide")
    .max(15, "Plaque d'immatriculation trop longue"),
  zones: z.array(z.string())
    .min(1, "Au moins une zone doit être sélectionnée"),
  isVerified: z.boolean()
});

const availableZones = [
  'Moroni', 'Mutsamudu', 'Fomboni', 'Domoni', 'Tsembehou', 
  'Mirontsy', 'Ouani', 'Sima', 'Mramani', 'Adda-Douéni'
];

const vehicleTypes = [
  { value: 'SEDAN', label: 'Berline' },
  { value: 'SUV', label: 'SUV' },
  { value: 'MOTORCYCLE', label: 'Moto' },
  { value: 'VAN', label: 'Van' }
];

export default function DriverForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [driver, setDriver] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      phoneNumber: '+269',
      zones: [],
      isVerified: false
    }
  });

  const watchedZones = watch('zones');

  useEffect(() => {
    if (isEdit && id) {
      loadDriver();
    }
  }, [id, isEdit]);

  const loadDriver = async () => {
    try {
      setLoading(true);
      const data = await driversService.getDriver(id!);
      setDriver(data.driver);
      
      // Populate form with driver data
      reset({
        phoneNumber: data.driver.phoneNumber,
        name: data.driver.name,
        licenseNumber: data.driver.licenseNumber,
        vehicleType: data.driver.vehicleType,
        vehiclePlate: data.driver.vehiclePlate,
        zones: data.driver.zones,
        isVerified: data.driver.isVerified
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: DriverFormData) => {
    try {
      setLoading(true);
      setError('');
      
      if (isEdit) {
        await driversService.updateDriver(id!, data);
      } else {
        await driversService.createDriver(data);
      }
      
      navigate('/admin/drivers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleZoneToggle = (zone: string) => {
    const currentZones = watchedZones || [];
    const newZones = currentZones.includes(zone)
      ? currentZones.filter(z => z !== zone)
      : [...currentZones, zone];
    setValue('zones', newZones);
  };

  if (loading && isEdit && !driver) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-gray-600">Chargement du chauffeur...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => navigate('/admin/drivers')}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Retour
          </button>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? `Modifier ${driver?.name || 'chauffeur'}` : 'Nouveau chauffeur'}
        </h1>
        <p className="text-gray-600">
          {isEdit ? 'Modifiez les informations du chauffeur' : 'Ajoutez un nouveau chauffeur à la plateforme'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="card p-6 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informations personnelles */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informations personnelles</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet *
                </label>
                <input
                  {...register('name')}
                  type="text"
                  className="input"
                  placeholder="Nom du chauffeur"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de téléphone *
                </label>
                <input
                  {...register('phoneNumber')}
                  type="tel"
                  className="input"
                  placeholder="+269XXXXXXX"
                />
                {errors.phoneNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numéro de permis *
              </label>
              <input
                {...register('licenseNumber')}
                type="text"
                className="input"
                placeholder="Numéro de permis de conduire"
              />
              {errors.licenseNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.licenseNumber.message}</p>
              )}
            </div>
          </div>

          {/* Informations véhicule */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Véhicule</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de véhicule *
                </label>
                <select {...register('vehicleType')} className="input">
                  <option value="">Sélectionner un type</option>
                  {vehicleTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {errors.vehicleType && (
                  <p className="mt-1 text-sm text-red-600">{errors.vehicleType.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plaque d'immatriculation *
                </label>
                <input
                  {...register('vehiclePlate')}
                  type="text"
                  className="input"
                  placeholder="123ABC"
                />
                {errors.vehiclePlate && (
                  <p className="mt-1 text-sm text-red-600">{errors.vehiclePlate.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Zones d'activité */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Zones d'activité</h3>
            <p className="text-sm text-gray-600 mb-4">
              Sélectionnez les zones où ce chauffeur peut opérer
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availableZones.map((zone) => (
                <label key={zone} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={watchedZones?.includes(zone) || false}
                    onChange={() => handleZoneToggle(zone)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">{zone}</span>
                </label>
              ))}
            </div>
            {errors.zones && (
              <p className="mt-1 text-sm text-red-600">{errors.zones.message}</p>
            )}
          </div>

          {/* Vérification */}
          <div>
            <label className="flex items-center">
              <input
                {...register('isVerified')}
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700">
                Marquer comme vérifié
              </span>
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Les chauffeurs vérifiés peuvent accepter des courses
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/admin/drivers')}
              className="btn btn-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isEdit ? 'Modification...' : 'Création...'}
                </>
              ) : (
                isEdit ? 'Modifier le chauffeur' : 'Créer le chauffeur'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
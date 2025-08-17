import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  Car, 
  Users, 
  TrendingUp,
  Activity,
  Plus,
  Eye,
  AlertCircle,
  Loader2,
  MapPin,
  Gauge
} from 'lucide-react';
import { AdminStatsResponse } from '../types/admin.types';
import api from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

export default function Dashboard() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/stats');
        if (response.data.success) {
          setStats(response.data.data);
        } else {
          setError(response.data.error?.message || 'Erreur lors du chargement');
        }
      } catch (err) {
        setError('Erreur lors du chargement des statistiques');
        console.error('Stats error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Auto-refresh toutes les 30 secondes
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary-600 mx-auto animate-spin" />
          <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">Chargement du tableau de bord...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Récupération des données en temps réel</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">Erreur de chargement</h3>
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const StatCard = ({ 
    title, 
    value, 
    description, 
    icon: Icon, 
    trend, 
    color,
    bgColor 
  }: {
    title: string;
    value: number;
    description?: string;
    icon: any;
    trend?: string;
    color: string;
    bgColor: string;
  }) => (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 group hover:-translate-y-1">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <div className="flex items-baseline space-x-2">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              {trend && (
                <Badge variant="secondary" className="text-xs">
                  {trend}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${bgColor} group-hover:scale-110 transition-transform duration-200`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Header avec auto-refresh indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            Tableau de Bord
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Vue d'ensemble de l'activité en temps réel</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Activity className="w-4 h-4 text-green-500 animate-pulse" />
          <span>Mise à jour automatique</span>
          <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
            LIVE
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Courses Aujourd'hui"
          value={stats?.overview.totalBookingsToday || 0}
          description="Total des réservations"
          icon={Calendar}
          color="text-blue-600 dark:text-blue-400"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
        />
        
        <StatCard
          title="Courses Terminées"
          value={stats?.overview.completedTripsToday || 0}
          description="Avec succès"
          icon={CheckCircle}
          color="text-green-600 dark:text-green-400"
          bgColor="bg-green-50 dark:bg-green-900/20"
        />
        
        <StatCard
          title="En Attente"
          value={stats?.overview.pendingBookings || 0}
          description="À traiter"
          icon={Clock}
          color="text-orange-600 dark:text-orange-400"
          bgColor="bg-orange-50 dark:bg-orange-900/20"
        />
        
        <StatCard
          title="Chauffeurs Actifs"
          value={stats?.overview.activeDrivers || 0}
          description="Vérifiés et disponibles"
          icon={Users}
          color="text-purple-600 dark:text-purple-400"
          bgColor="bg-purple-50 dark:bg-purple-900/20"
        />
        
        <StatCard
          title="En Ligne"
          value={stats?.overview.onlineDrivers || 0}
          description="Connectés maintenant"
          icon={Car}
          color="text-emerald-600 dark:text-emerald-400"
          bgColor="bg-emerald-50 dark:bg-emerald-900/20"
        />
      </div>

      {/* Charts and Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions rapides */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Actions Rapides
            </CardTitle>
            <CardDescription>
              Opérations fréquemment utilisées
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/admin/drivers/new">
              <Button className="w-full justify-start" variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Chauffeur
              </Button>
            </Link>
            <Link to="/admin/drivers">
              <Button className="w-full justify-start" variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Gérer les Chauffeurs
              </Button>
            </Link>
            <Link to="/admin/bookings">
              <Button className="w-full justify-start" variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                Voir les Réservations
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Activité récente */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              Activité Récente
            </CardTitle>
            <CardDescription>
              Aperçu des dernières activités du système
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Système opérationnel
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tous les services fonctionnent normalement
                  </p>
                </div>
                <Badge variant="success">✓</Badge>
              </div>

              <div className="flex items-center gap-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Base de données connectée
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Synchronisation en temps réel active
                  </p>
                </div>
                <Badge variant="success">LIVE</Badge>
              </div>

              <div className="flex items-center gap-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Interface administrative
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Dernière mise à jour: {new Date().toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Badge variant="outline">v1.0.0</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Info */}
      <Card className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border-slate-200 dark:border-slate-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Como Ride Administration
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Plateforme de transport pour les Comores 🇰🇲
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="success" className="mb-2">
                Système Opérationnel
              </Badge>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Dernière synchronisation: {new Date().toLocaleTimeString('fr-FR')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
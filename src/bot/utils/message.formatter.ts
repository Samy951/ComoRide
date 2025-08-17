import { ConversationData } from '../states/state.types';

export class MessageFormatter {
  static formatWelcomeMenu(name?: string): string {
    const greeting = name ? `Bonjour ${name} !` : 'Bonjour !';
    
    return `🚗 *Como Ride - Transport Sûr*

${greeting} 👋

Choisissez une option :
🔹 *1* - Nouvelle réservation  
🔹 *2* - Mes trajets récents
🔹 *3* - Aide & Contact

_Tapez le numéro de votre choix_

---
💡 *Nouveau chez Como Ride ?*
Tapez *AIDE* pour commencer`;
  }

  static formatBookingStart(): string {
    return `🎯 *Nouvelle Réservation*

D'où partons-nous ?
📍 Envoyez votre adresse de départ

_Exemple : Moroni Centre, près du marché_

❌ Tapez 0 pour annuler`;
  }

  static formatBookingDrop(pickupAddress: string): string {
    return `📍 Départ : ${pickupAddress}

Où allons-nous ?
🎯 Envoyez votre destination

_Exemple : Aéroport Prince Said Ibrahim_`;
  }

  static formatBookingTime(): string {
    return `🕐 Quand voulez-vous partir ?

*1* - Maintenant
*2* - Dans 30 minutes  
*3* - Dans 1 heure
*4* - Autre horaire (préciser)

⏰ Réservation jusqu'à 24h à l'avance`;
  }

  static formatBookingConfirm(data: ConversationData): string {
    const timeStr = data.pickupTime ? 
      new Date(data.pickupTime).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Maintenant';

    const fareStr = data.estimatedFare ? 
      `${data.estimatedFare} KMF` : 'À confirmer';

    return `✅ *Résumé de votre réservation*

📍 **Départ :** ${data.pickupAddress}
🎯 **Arrivée :** ${data.dropAddress}  
🕐 **Horaire :** ${timeStr}
👥 **Passagers :** ${data.passengers || 1}

💰 **Tarif estimé :** ${fareStr}

*1* - Confirmer la réservation
*2* - Modifier les détails
*0* - Annuler

⚡ Confirmation en moins de 2 minutes`;
  }

  static formatBookingWaiting(): string {
    return `🔍 *Recherche d'un chauffeur...*

⏱️ Temps estimé : 30-90 secondes
📱 Vous recevrez une notification dès qu'un chauffeur accepte

🚫 Tapez *ANNULER* pour annuler`;
  }

  static formatDriverFound(driverName: string, vehicleInfo: string, rating: number): string {
    const stars = '⭐'.repeat(Math.floor(rating));
    
    return `✅ *Chauffeur trouvé !*

👨‍💼 **${driverName}** ${stars} (${rating.toFixed(1)})
🚗 **Véhicule :** ${vehicleInfo}

📱 Le chauffeur vous contactera dans 2-3 minutes
🕐 Temps d'arrivée estimé : 5-15 minutes

Bon voyage avec Como Ride ! 🚗💨`;
  }

  static formatBookingHistory(trips: any[]): string {
    if (trips.length === 0) {
      return `📚 *Vos trajets récents*

Aucun trajet récent trouvé.

*1* - Faire une nouvelle réservation
*0* - Retour menu principal`;
    }

    let message = `📚 *Vos trajets récents*\n\n`;
    
    trips.forEach((trip) => {
      const date = new Date(trip.createdAt).toLocaleDateString('fr-FR');
      const rating = trip.driverRating ? `⭐ ${trip.driverRating.toFixed(1)}` : 'Non noté';
      
      message += `🚗 **${date}** - ${trip.booking.pickupAddress} → ${trip.booking.dropAddress}\n`;
      message += `   Chauffeur : ${trip.driver.name} ${rating}\n`;
      message += `   Tarif : ${trip.fare} KMF\n\n`;
    });

    message += `*1* - Voir plus de trajets\n`;
    message += `*2* - Refaire une réservation identique\n`;
    message += `*0* - Retour menu principal`;

    return message;
  }

  static formatTimeoutWarning(): string {
    return `👋 Toujours là ?
Votre réservation est en attente...

Tapez *CONTINUER* ou *MENU* pour le menu principal`;
  }

  static formatTimeoutReset(): string {
    return `⏰ Session expirée par inactivité

Vos informations sont sauvegardées.
Tapez *REPRENDRE* pour continuer ou un numéro pour le menu.`;
  }

  static formatReconnectionMessage(data?: ConversationData): string {
    if (data && data.pickupAddress) {
      return `🔄 *Connexion rétablie*

Voulez-vous continuer votre réservation ?
📍 ${data.pickupAddress} → ${data.dropAddress || '...'}

*1* - Continuer
*0* - Nouvelle réservation`;
    }

    return `🔄 *Connexion rétablie*

Como Ride est de nouveau disponible ! 
Que souhaitez-vous faire ?

Tapez un numéro pour le menu principal.`;
  }

  static formatErrorMessage(error: string, canRetry: boolean = true): string {
    let message = `❌ *Erreur*\n\n${error}`;
    
    if (canRetry) {
      message += `\n\n*1* - Réessayer\n*0* - Retour menu principal`;
    }
    
    return message;
  }

  static formatApiError(): string {
    return this.formatErrorMessage(
      'Problème technique temporaire.\nVeuillez réessayer dans 2 minutes.',
      true
    );
  }

  static formatHelpMessage(): string {
    return `🆘 *Aide Como Ride*

**Comment réserver :**
1️⃣ Tapez 1 dans le menu principal
2️⃣ Indiquez votre adresse de départ
3️⃣ Indiquez votre destination  
4️⃣ Choisissez l'horaire
5️⃣ Confirmez votre réservation

**Zones desservies :**
• Moroni et environs
• Mutsamudu  
• Fomboni
• Aéroports

**Support client :**
📞 Appelez le +269 XX XX XX XX
🕐 Disponible 7j/7 de 6h à 22h

*0* - Retour menu principal`;
  }

  static formatInvalidInput(): string {
    return `❓ Option non reconnue.

Tapez un numéro valide ou *MENU* pour revenir au menu principal.`;
  }
}
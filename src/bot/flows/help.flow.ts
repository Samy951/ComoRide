import { ConversationState } from '../states/state.types';
import { SessionManager } from '../states/session.manager';
import { MessageFormatter } from '../utils/message.formatter';
import { ValidationUtils } from '../utils/validation.utils';
import { WhatsAppService } from '../services/whatsapp.service';
import logger from '@config/logger';

export class HelpFlow {
  private sessionManager: SessionManager;
  private whatsappService: WhatsAppService;

  constructor(whatsappService: WhatsAppService) {
    this.sessionManager = SessionManager.getInstance();
    this.whatsappService = whatsappService;
  }

  async handleHelpMode(phoneNumber: string): Promise<void> {
    try {
      await this.sessionManager.setState(phoneNumber, ConversationState.HELP_MODE);
      
      const message = MessageFormatter.formatHelpMessage();
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('Help mode activated', {
        phoneNumber: this.maskPhone(phoneNumber)
      });
    } catch (error) {
      logger.error('Failed to show help', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'affichage de l\'aide');
    }
  }

  async handleHelpAction(phoneNumber: string, input: string): Promise<void> {
    try {
      if (ValidationUtils.isCancelOption(input)) {
        await this.returnToMenu(phoneNumber);
        return;
      }

      const option = ValidationUtils.parseMenuOption(input);
      
      switch (option) {
        case 1:
          await this.showDetailedBookingGuide(phoneNumber);
          break;
          
        case 2:
          await this.showZonesInfo(phoneNumber);
          break;
          
        case 3:
          await this.showContactInfo(phoneNumber);
          break;
          
        case 0:
          await this.returnToMenu(phoneNumber);
          break;
          
        default:
          await this.handleUnknownHelpCommand(phoneNumber, input);
      }
    } catch (error) {
      logger.error('Failed to handle help action', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'aide');
    }
  }

  private async showDetailedBookingGuide(phoneNumber: string): Promise<void> {
    const message = `📖 *Guide de réservation détaillé*

**Étape 1 : Démarrage**
• Tapez *1* dans le menu principal
• Le bot vous demande votre point de départ

**Étape 2 : Adresse de départ**
• Soyez précis : "Moroni Centre, près du marché"
• Indiquez des repères connus
• Minimum 5 caractères requis

**Étape 3 : Destination**
• Même principe que le départ
• Exemples valides :
  - "Aéroport Prince Said Ibrahim"
  - "Mutsamudu centre-ville"
  - "Fomboni, près de la mosquée"

**Étape 4 : Horaire**
• *1* = Maintenant (départ immédiat)
• *2* = Dans 30 minutes
• *3* = Dans 1 heure
• *4* = Horaire personnalisé

**Étape 5 : Confirmation**
• Vérifiez tous les détails
• Confirmez avec *1*
• Modifiez avec *2* si besoin

**Conseils :**
💡 Plus vous êtes précis, plus vite on trouve votre chauffeur
💡 Réservez 15-30min à l'avance pour garantir la disponibilité

*0* - Retour aide principale`;

    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async showZonesInfo(phoneNumber: string): Promise<void> {
    const message = `🗺️ *Zones desservies par Como Ride*

**🏙️ Grande Comore (Ngazidja)**
• Moroni et environs
• Itsandra
• Mitsoudjé
• Foumbouni
• Aéroport Prince Said Ibrahim

**🏝️ Anjouan (Nzwani)**
• Mutsamudu centre
• Domoni
• Sima
• Ouani
• Aéroport Anjouan

**🌴 Mohéli (Mwali)**
• Fomboni centre
• Nioumachoua
• Aéroport Mohéli

**⏰ Horaires de service**
• 6h00 - 22h00 tous les jours
• Service 24h/24 pour aéroports

**💰 Tarifs indicatifs**
• Intra-ville : 1000-2000 KMF
• Inter-zones : 2000-4000 KMF  
• Aéroport : +1000 KMF de supplément

*0* - Retour aide principale`;

    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async showContactInfo(phoneNumber: string): Promise<void> {
    const message = `📞 *Contact et Support*

**🆘 Support client**
📱 Téléphone : +269 XX XX XX XX
🕐 Disponible 7j/7 de 6h à 22h

**💬 Support WhatsApp**
Vous pouvez toujours nous écrire ici !
Nos agents répondent en moins de 5 minutes.

**🌐 Réseaux sociaux**
Facebook : Como Ride Comores
Instagram : @comoride_officiel

**📧 Email professionnel**
contact@como-ride.km

**🚨 Urgences**
En cas de problème pendant un trajet :
• Contactez le +269 XX XX XX XX
• Ou écrivez "URGENCE" ici

**📝 Réclamations**
Votre satisfaction est notre priorité.
Signalez tout problème via :
• Ce chat WhatsApp
• Notre ligne téléphonique
• Email : reclamations@como-ride.km

⭐ *Évaluez votre chauffeur* après chaque course pour améliorer notre service !

*0* - Retour aide principale`;

    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async handleUnknownHelpCommand(phoneNumber: string, input: string): Promise<void> {
    // Check if it's a specific question or keyword
    const lowerInput = input.toLowerCase().trim();
    
    if (lowerInput.includes('tarif') || lowerInput.includes('prix')) {
      await this.showPricingInfo(phoneNumber);
    } else if (lowerInput.includes('annul') || lowerInput.includes('modif')) {
      await this.showCancellationInfo(phoneNumber);
    } else if (lowerInput.includes('paiement') || lowerInput.includes('orange money')) {
      await this.showPaymentInfo(phoneNumber);
    } else {
      const message = `❓ Question non reconnue : "${input}"

Tapez un numéro pour naviguer dans l'aide :

*1* - Guide de réservation
*2* - Zones desservies  
*3* - Contact support
*0* - Retour menu principal

Ou posez votre question autrement.`;

      await this.whatsappService.sendMessage(phoneNumber, message);
    }
  }

  private async showPricingInfo(phoneNumber: string): Promise<void> {
    const message = `💰 *Informations Tarifs*

**🏙️ Tarifs de base**
• Course intra-ville : 1000-2000 KMF
• Course inter-zones : 2000-4000 KMF
• Supplément aéroport : +1000 KMF
• Supplément nocturne (22h-6h) : +500 KMF

**📊 Calcul du tarif**
• Distance parcourue
• Zone de départ et d'arrivée  
• Horaire (jour/nuit)
• Demande en temps réel

**💳 Modes de paiement**
• Espèces (recommandé)
• Orange Money (bientôt disponible)

**🎯 Tarif estimé**
Vous voyez le prix estimé avant de confirmer !
Le tarif final peut varier légèrement (+/- 10%).

*0* - Retour aide principale`;

    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async showCancellationInfo(phoneNumber: string): Promise<void> {
    const message = `✏️ *Annulation et Modification*

**🚫 Annuler une réservation**
• Tapez *ANNULER* à tout moment
• Gratuit jusqu'à attribution du chauffeur
• Frais de 500 KMF après attribution

**✏️ Modifier une réservation**
• Possible avant attribution du chauffeur
• Tapez *2* à l'écran de confirmation
• Choisissez ce que vous voulez modifier

**⏰ Délais**
• Modification gratuite : jusqu'à 5 min avant le départ
• Annulation gratuite : jusqu'à attribution du chauffeur

**🚗 Après attribution du chauffeur**
• Contactez directement votre chauffeur
• Ou appelez le support : +269 XX XX XX XX
• Frais possibles selon la situation

**💡 Conseil**
Vérifiez bien vos informations avant la confirmation finale !

*0* - Retour aide principale`;

    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async showPaymentInfo(phoneNumber: string): Promise<void> {
    const message = `💳 *Modes de Paiement*

**💵 Espèces (Disponible)**
• Mode principal actuellement
• Payez directement au chauffeur
• Monnaie disponible recommandée

**📱 Orange Money (Bientôt)**
• Intégration en cours de développement
• Paiement sécurisé via votre compte
• Plus de commodité, moins de manipulation

**🔐 Sécurité**
• Tous nos chauffeurs sont vérifiés
• Reçu fourni pour chaque course
• Transaction enregistrée dans l'historique

**💰 Tarification transparente**
• Prix annoncé = prix final (± 10% max)
• Aucun frais caché
• Supplément annoncé à l'avance

**📊 Suivi des paiements**
• Historique dans l'app
• Récapitulatif mensuel disponible
• Export pour comptabilité

*0* - Retour aide principale`;

    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async returnToMenu(phoneNumber: string): Promise<void> {
    await this.sessionManager.resetSession(phoneNumber);
    
    const message = MessageFormatter.formatWelcomeMenu();
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    logger.info('Returned to menu from help', {
      phoneNumber: this.maskPhone(phoneNumber)
    });
  }

  private async handleError(phoneNumber: string, errorMessage: string): Promise<void> {
    const message = MessageFormatter.formatErrorMessage(errorMessage);
    await this.whatsappService.sendMessage(phoneNumber, message);
    await this.sessionManager.resetSession(phoneNumber);
  }

  private maskPhone(phoneNumber: string): string {
    return phoneNumber.length > 4 ? 
      phoneNumber.substring(0, phoneNumber.length - 4) + 'XXXX' : 
      'XXXX';
  }
}
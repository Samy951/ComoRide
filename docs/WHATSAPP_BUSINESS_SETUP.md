# Configuration WhatsApp Business API pour Como Ride

## Option 1: Twilio (Recommandé pour démarrer)

### Étapes de configuration:

1. **Créer un compte Twilio**
   - Aller sur [twilio.com](https://www.twilio.com)
   - S'inscrire pour un compte business
   - Vérifier votre email et numéro

2. **Activer WhatsApp sur Twilio**
   - Dans la console Twilio → Messaging → Try it out → WhatsApp
   - Suivre le processus de vérification business
   - Obtenir un numéro WhatsApp approuvé

3. **Configurer les webhooks**
   ```
   Webhook URL: https://votre-domaine.com/api/webhooks/whatsapp
   ```

4. **Variables d'environnement**
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+1415238886
   ```

## Option 2: Meta Cloud API (Direct)

### Prérequis:
- Compte Meta Business vérifié
- Domaine vérifié
- Privacy Policy et Terms of Service

### Étapes:

1. **Meta for Developers**
   - Créer une app sur developers.facebook.com
   - Ajouter WhatsApp comme produit
   - Configurer le webhook

2. **Vérification Business**
   - Soumettre documents d'entreprise
   - Attendre validation (2-3 jours)

3. **Configuration API**
   ```env
   WHATSAPP_API_URL=https://graph.facebook.com/v17.0
   WHATSAPP_BUSINESS_ID=your_business_id
   WHATSAPP_PHONE_ID=your_phone_number_id
   WHATSAPP_ACCESS_TOKEN=your_access_token
   ```

## Option 3: 360dialog (Pour l'Afrique)

Recommandé pour les Comores car ils ont une bonne couverture Afrique.

### Avantages:
- Support local en français
- Tarifs adaptés à l'Afrique
- Assistance pour la vérification

### Configuration:
1. S'inscrire sur [360dialog.com](https://www.360dialog.com)
2. Demander un numéro WhatsApp Business
3. Intégrer leur API

## Coûts estimés:

| Provider | Setup | Par message | Volume min |
|----------|-------|-------------|------------|
| Twilio | $0 | $0.005 | 1000/mois |
| Meta Direct | $0 | $0.003 | 1000/mois |
| 360dialog | €19/mois | €0.004 | Illimité |

## Migration du code actuel:

Le code actuel utilise `whatsapp-web.js` qui simule WhatsApp Web.
Pour la production, il faut migrer vers l'API officielle.

### Changements nécessaires:

1. **Remplacer whatsapp-web.js**
   ```bash
   npm uninstall whatsapp-web.js puppeteer
   npm install twilio  # ou @whiskeysockets/baileys pour Meta API
   ```

2. **Adapter le service WhatsApp**
   - Utiliser les webhooks au lieu du polling
   - Gérer les templates de messages
   - Implémenter la file d'attente

3. **Ajouter un serveur HTTPS**
   - Certificat SSL obligatoire
   - Domaine vérifié
   - Webhook sécurisé

## Timeline de migration:

1. **Semaine 1**: Création compte business, vérification
2. **Semaine 2**: Configuration API, tests sandbox
3. **Semaine 3**: Migration code, tests
4. **Semaine 4**: Déploiement production

## Support:
- Twilio: support@twilio.com
- Meta: business.facebook.com/support
- 360dialog: support@360dialog.com
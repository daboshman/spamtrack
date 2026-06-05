import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ credential: cert('./serviceAccountKey.json') });

getAuth().projectConfigManager().updateProjectConfig({
  multiFactorConfig: {
    providerConfigs: [{
      state: "ENABLED",
      totpProviderConfig: { adjacentIntervals: 5 }
    }]
  }
}).then(() => {
  console.log("TOTP enabled!");
}).catch((err) => {
  console.error("Error:", err);
});
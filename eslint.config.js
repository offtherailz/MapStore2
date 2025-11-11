
import myEslintConfig from '@mapstore/eslint-config-mapstore';
import { defineConfig } from "eslint/config";

export default defineConfig([
    // Importa e usa la configurazione
    ...myEslintConfig,
    {
    ignores: [
            "**/node_modules/",
            "web/client/dist/",
            "web/client/test-resources/",
            "web/docs/",
            "web/client/mapstore/docs/",
            "**/*.min.js" // Esempio: escludi file minificati
        ]
    }
    // ...eventuali altre regole specifiche per questo progetto
]);

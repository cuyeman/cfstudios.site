#!/usr/bin/env node
/**
 * validate-locales.js
 * Compara los 4 archivos de Lenguague/*.json contra schema.json.
 * Uso: node validate-locales.js
 * Sale con código 1 si falta alguna llave (útil como paso de build/CI antes del PR).
 */

const fs = require('fs');
const path = require('path');

const LOCALE_DIR = path.join(__dirname, 'Lenguague');
const SCHEMA_PATH = path.join(LOCALE_DIR, 'schema.json');
const LANGS = ['es', 'en', 'pt', 'hi'];

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`❌ No se pudo leer o parsear: ${filePath}`);
    console.error(`   Motivo: ${err.message}`);
    process.exit(1);
  }
}

function main() {
  console.log('🔍 Validando Lenguague/*.json contra schema.json...\n');

  const schema = loadJSON(SCHEMA_PATH);
  let hasErrors = false;

  for (const lang of LANGS) {
    const filePath = path.join(LOCALE_DIR, `${lang}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Falta el archivo: ${lang}.json`);
      hasErrors = true;
      continue;
    }

    const data = loadJSON(filePath);
    let fileHasErrors = false;

    for (const namespace of ['landing', 'prologo']) {
      const expectedKeys = schema[namespace] || [];
      const actualKeys = new Set(Object.keys(data[namespace] || {}));
      const missing = expectedKeys.filter((k) => !actualKeys.has(k));

      if (missing.length > 0) {
        fileHasErrors = true;
        hasErrors = true;
        console.error(`❌ ${lang}.json → "${namespace}" — faltan ${missing.length} llave(s):`);
        missing.forEach((k) => console.error(`   - ${namespace}.${k}`));
      }
    }

    if (!fileHasErrors) {
      const total = Object.keys(data.landing || {}).length + Object.keys(data.prologo || {}).length;
      console.log(`✅ ${lang}.json — completo (${total} llaves)`);
    }
  }

  console.log('');
  if (hasErrors) {
    console.error('❌ Validación FALLIDA. Corrige las llaves faltantes antes de abrir el Pull Request.');
    process.exit(1);
  } else {
    console.log('✅ Todo correcto. Los 4 idiomas están sincronizados con schema.json.');
    process.exit(0);
  }
}

main();

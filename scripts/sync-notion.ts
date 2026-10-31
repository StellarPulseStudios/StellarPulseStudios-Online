import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';

import { getExhibitors } from '../src/lib/notion';

async function main() {
  console.log('Iniciando sincronización con Notion...');

  const exhibitors = await getExhibitors();

  const dataDirectory = path.join(process.cwd(), 'src', 'data');
  const outputFile = path.join(dataDirectory, 'exhibitors.json');

  await fs.mkdir(dataDirectory, { recursive: true });

  await fs.writeFile(
    outputFile,
    JSON.stringify(exhibitors, null, 2),
    'utf8'
  );

  console.log(
    `Sincronización completada: ${exhibitors.length} emprendimientos.`
  );

  console.log(`Datos guardados en: ${outputFile}`);
}

main().catch((error) => {
  console.error('Error durante la sincronización con Notion:', error);
  process.exitCode = 1;
});
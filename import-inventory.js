#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Uso: node import-inventory.js "<caminho-do-csv>"');
  console.error('Exemplo: node import-inventory.js "C:\\Users\\...\\Planilha inventario.csv"');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`Arquivo não encontrado: ${csvPath}`);
  process.exit(1);
}

const CONTAINER = 'gestaoinventario-mysql-1';
const DB = 'GestaoInventario';

// Read and parse CSV (UTF-8 with BOM)
const content = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');
const lines = content.split(/\r?\n/);

const sqlLines = [
  'SET NAMES utf8mb4;',
  'ALTER TABLE produto MODIFY Nome varchar(255) NOT NULL;',
  'ALTER TABLE produto MODIFY Modelo varchar(255) NOT NULL;',
];

let count = 0;
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = line.split(';');
  const id    = parts[0]?.trim();
  const nome  = parts[1]?.trim();
  const qtdRaw = parts[3]?.trim() || '0';

  if (!id || !nome) continue; // pula linhas sem ID (ex: ;;;6055 no fim)

  // Converte formato brasileiro "1.151,00" → 1151
  const qtd = Math.round(parseFloat(qtdRaw.replace(/\./g, '').replace(',', '.')) || 0);

  const nomeSafe = nome.replace(/'/g, "''");

  sqlLines.push(
    `INSERT IGNORE INTO produto (Id, Nome, Modelo, Categoria, Qtd, Dta_atualizacao) ` +
    `VALUES ('${id}', '${nomeSafe}', 'Sem modelo', 1, ${qtd}, CURDATE());`
  );
  count++;
}

console.log(`\nPreparando importação de ${count} produtos...`);

const sqlContent = sqlLines.join('\n');

const result = spawnSync(
  'docker',
  ['exec', '-i', CONTAINER, 'mysql', '--default-character-set=utf8mb4', '-u', 'root', '-p123456', DB],
  { input: sqlContent, encoding: 'utf-8', stdio: ['pipe', 'inherit', 'pipe'] }
);

// Ignora apenas o aviso de senha; exibe outros erros
const stderr = (result.stderr || '').split('\n').filter(l => !l.includes('[Warning] Using a password'));
if (stderr.some(l => l.trim())) console.error(stderr.join('\n'));

if (result.status === 0) {
  console.log(`\n✅ ${count} produtos importados com sucesso!`);
} else {
  console.error('\n❌ Erro na importação. Verifique as mensagens acima.');
  process.exit(1);
}

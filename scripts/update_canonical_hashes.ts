import mysql from 'mysql2/promise';
import crypto from 'crypto';

function calculateDocumentHash(params: {
  holder_name: string;
  document_type: string;
  institution_id: number | string;
  course: string;
  issue_date: string | Date;
}): string {
  const normDate = (typeof params.issue_date === 'string')
    ? params.issue_date.split('T')[0]
    : new Date(params.issue_date).toISOString().split('T')[0];

  const canonicalPayload = [
    params.holder_name.trim(),
    params.document_type.trim(),
    String(params.institution_id),
    params.course.trim(),
    normDate,
  ].join('|');

  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

async function updateHashes() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'veridoc',
    password: 'veridoc_secret',
    database: 'veridoc',
  });

  const [docs]: any = await pool.query('SELECT id, holder_name, document_type, institution_id, course, issue_date, verification_code FROM documents');
  console.log(`Atualizando hashes canônicos SHA-256 para ${docs.length} documentos...`);

  for (const doc of docs) {
    const canonicalHash = calculateDocumentHash({
      holder_name: doc.holder_name,
      document_type: doc.document_type,
      institution_id: doc.institution_id,
      course: doc.course,
      issue_date: doc.issue_date,
    });

    await pool.query('UPDATE documents SET hash = ? WHERE id = ?', [canonicalHash, doc.id]);
    console.log(`✓ Doc #${doc.id} (${doc.verification_code}): Hash atualizado para ${canonicalHash.substring(0, 16)}...`);
  }

  console.log('Todos os hashes SHA-256 sincronizados com sucesso!');
  process.exit(0);
}

updateHashes();

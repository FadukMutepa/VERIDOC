import mysql from 'mysql2/promise';
import QRCode from 'qrcode';

async function regenerate() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'veridoc',
    password: 'veridoc_secret',
    database: 'veridoc',
  });

  const [docs]: any = await pool.query('SELECT id, verification_code FROM documents');
  console.log(`Regenerando QR Codes para ${docs.length} documentos...`);

  for (const doc of docs) {
    const url = `http://localhost:3000/verificar/${doc.verification_code}`;
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#0A1428', light: '#FFFFFF' }
    });

    await pool.query('UPDATE documents SET qr_code = ? WHERE id = ?', [qrCodeDataUrl, doc.id]);
    console.log(`✓ Doc #${doc.id} (${doc.verification_code}) -> ${url}`);
  }

  console.log('Todos os QR Codes atualizados com sucesso para /verificar/{codigo}!');
  process.exit(0);
}

regenerate();

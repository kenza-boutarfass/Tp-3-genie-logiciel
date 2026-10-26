require('dotenv').config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  throw new Error('JWT_SECRET doit être défini et contenir au moins 24 caractères.');
}
const app = require('./app');
const port = Number(process.env.PORT || 5001);
app.listen(port, '0.0.0.0', () => console.log(`API disponible sur http://localhost:${port}`));
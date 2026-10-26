const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const users = require('../models/userModel');
const { validEmail, requiredText } = require('../utils/validation');

function login(req, res) {
  try {
    const email = validEmail(req.body.email);
    const password = requiredText(req.body.motDePasse, 'Mot de passe', 200);
    const user = users.findByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.mot_de_passe)) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, utilisateur: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role } });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = { login };
const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');

router.post('/', async (req, res) => {
  try {
    const nuevoUsuario = new Usuario(req.body);
    await nuevoUsuario.save();
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { nombre, contrasena } = req.body;
    const usuario = await Usuario.findOne({ nombre, contrasena });
    
    if (usuario) {
      res.json(usuario);
    } else {
      res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

module.exports = router;
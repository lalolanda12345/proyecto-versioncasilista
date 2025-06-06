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
      // Guardar la sesión del usuario
      req.session.usuario = usuario;
      res.json(usuario);
    } else {
      res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Ruta para verificar sesión activa
router.get('/session', (req, res) => {
  if (req.session.usuario) {
    res.json(req.session.usuario);
  } else {
    res.status(401).json({ mensaje: 'No hay sesión activa' });
  }
});

// Ruta para cerrar sesión
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ mensaje: 'Error al cerrar sesión' });
    } else {
      res.json({ mensaje: 'Sesión cerrada correctamente' });
    }
  });
});

module.exports = router;
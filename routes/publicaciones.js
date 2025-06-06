const express = require('express');
const router = express.Router();
const Publicacion = require('../models/Publicacion');

router.post('/', async (req, res) => {
  try {
    const nuevaPublicacion = new Publicacion(req.body);
    await nuevaPublicacion.save();
    res.status(201).json(nuevaPublicacion);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const publicaciones = await Publicacion.find().populate('usuario');
    res.json(publicaciones);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Ruta para dar like a una publicación
router.post('/:id/like', async (req, res) => {
  try {
    const publicacion = await Publicacion.findById(req.params.id);
    if (!publicacion) {
      return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    }
    
    publicacion.likes += 1;
    await publicacion.save();
    res.json(publicacion);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

module.exports = router;
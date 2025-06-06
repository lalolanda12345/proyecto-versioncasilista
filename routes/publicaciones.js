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

// Ruta para dar/quitar like a una publicación
router.post('/:id/like', async (req, res) => {
  try {
    const { usuarioId } = req.body;
    const publicacion = await Publicacion.findById(req.params.id);
    
    if (!publicacion) {
      return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    }
    
    const yaLeDioLike = publicacion.usuariosQueDieronLike.includes(usuarioId);
    
    if (yaLeDioLike) {
      // Quitar like
      publicacion.usuariosQueDieronLike = publicacion.usuariosQueDieronLike.filter(
        id => id.toString() !== usuarioId
      );
      publicacion.likes -= 1;
    } else {
      // Dar like
      publicacion.usuariosQueDieronLike.push(usuarioId);
      publicacion.likes += 1;
    }
    
    await publicacion.save();
    
    // Devolver la publicación actualizada con información de población
    const publicacionActualizada = await Publicacion.findById(req.params.id).populate('usuario');
    res.json(publicacionActualizada);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

module.exports = router;
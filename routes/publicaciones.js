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

// Ruta para editar una publicación
router.put('/:id', async (req, res) => {
  try {
    const { usuarioId, contenido, imagen } = req.body;
    const publicacion = await Publicacion.findById(req.params.id).populate('usuario');
    
    if (!publicacion) {
      return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    }
    
    // Verificar que el usuario sea el propietario de la publicación
    if (publicacion.usuario._id.toString() !== usuarioId) {
      return res.status(403).json({ mensaje: 'No tienes permisos para editar esta publicación' });
    }
    
    publicacion.contenido = contenido;
    if (imagen) publicacion.imagen = imagen;
    
    await publicacion.save();
    
    const publicacionActualizada = await Publicacion.findById(req.params.id).populate('usuario');
    res.json(publicacionActualizada);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Ruta para eliminar una publicación
router.delete('/:id', async (req, res) => {
  try {
    const { usuarioId } = req.body;
    const publicacion = await Publicacion.findById(req.params.id).populate('usuario');
    
    if (!publicacion) {
      return res.status(404).json({ mensaje: 'Publicación no encontrada' });
    }
    
    // Verificar que el usuario sea el propietario de la publicación
    if (publicacion.usuario._id.toString() !== usuarioId) {
      return res.status(403).json({ mensaje: 'No tienes permisos para eliminar esta publicación' });
    }
    
    await Publicacion.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Publicación eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

module.exports = router;
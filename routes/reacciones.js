const express = require('express');
const router = express.Router();
const Reaccion = require('../models/Reaccion');

router.post('/', async (req, res) => {
  try {
    const nuevaReaccion = new Reaccion(req.body);
    await nuevaReaccion.save();
    res.status(201).json(nuevaReaccion);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const reacciones = await Reaccion.find().populate('usuario').populate('publicacion');
    res.json(reacciones);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

module.exports = router;
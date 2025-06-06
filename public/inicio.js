const usuario = JSON.parse(localStorage.getItem('usuario'));

const saludo = document.getElementById('saludoUsuario');
if (usuario) {
  saludo.textContent = `Bienvenido, ${usuario.nombre}`;
} else {
  window.location.href = 'index.html';
}

document.getElementById('cerrarSesionBtn').addEventListener('click', () => {
  localStorage.removeItem('usuario');
  window.location.href = 'index.html';
});

document.getElementById('verPublicacionesBtn').addEventListener('click', async () => {
  const res = await fetch('/publicaciones');
  const publicaciones = await res.json();

  const contenedor = document.getElementById('contenedorPublicaciones');
  contenedor.innerHTML = '';

  publicaciones.forEach(pub => {
    const div = document.createElement('div');
    div.innerHTML = `
      <h4>${pub.usuario?.nombre || 'Anónimo'}</h4>
      <p>${pub.contenido}</p>
      <small>${new Date(pub.fecha).toLocaleString()}</small>
      <hr/>
    `;
    contenedor.appendChild(div);
  });
});

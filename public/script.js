// Registro
const registroForm = document.getElementById('registroForm');
if (registroForm) {
  registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nuevoUsuario').value;
    const contrasena = document.getElementById('nuevaContrasena').value;

    const res = await fetch('/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, contrasena }),
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Usuario registrado: ' + data.nombre);
      window.location.href = 'index.html';
    } else {
      alert('❌ ' + data.mensaje);
    }
  });
}

// Verificar sesión activa al cargar la página de login
if (document.getElementById('loginForm')) {
  // Verificar si ya hay una sesión activa
  fetch('/usuarios/session')
    .then(res => {
      if (res.ok) {
        // Ya hay sesión activa, redirigir a home
        window.location.href = 'home.html';
      }
    })
    .catch(() => {
      // No hay sesión activa, continuar en login
    });
}

// Inicio de sesión
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('usuario').value;
    const contrasena = document.getElementById('contrasena').value;

    const res = await fetch('/usuarios/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, contrasena }),
    });

    const data = await res.json();
    if (res.ok) {
      alert('✅ Sesión iniciada como: ' + data.nombre);
      // Redirigir a la página de inicio
      window.location.href = 'home.html';
    } else {
      alert('❌ ' + data.mensaje);
    }
  });
}

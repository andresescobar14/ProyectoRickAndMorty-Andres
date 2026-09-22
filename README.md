# 🌌 Rick and Morty API - Catálogo Interactivo

🚀 **Live Demo:** [https://andresescobar14.github.io/ProyectoRickAndMorty-Andres/](https://andresescobar14.github.io/ProyectoRickAndMorty-Andres/register.html)

Una aplicación web frontend 100% responsiva que consume la API REST oficial de Rick and Morty. Permite a los usuarios registrarse, iniciar sesión, explorar el catálogo completo de personajes y gestionar una lista de favoritos personalizada.

## 📝 Descripción del Proyecto

Este proyecto pone en práctica fundamentos de desarrollo web y lógica de programación en JavaScript. La aplicación simula un entorno de sesión segura almacenando credenciales en memoria local, renderiza de forma asíncrona datos externos mediante la Fetch API y emplea Tailwind CSS para adaptar la interfaz a cualquier dispositivo móvil, tablet o escritorio.

## ✨ Características Principales

* **🔐 Autenticación de Usuarios:** Sistema de Registro y Login validado mediante expresiones regulares (Regex). Los datos se almacenan en `sessionStorage` para mantener la sesión activa.
* **📡 Consumo de API REST:** Peticiones asíncronas (`async/await`) a `rickandmortyapi.com` para listar personajes y renderizar sus detalles.
* **⭐ Gestión de Favoritos:** Funcionalidad para guardar personajes favoritos. La lista se persiste en `localStorage` y está enlazada exclusivamente al correo del usuario activo para evitar colisiones de datos.
* **👤 Perfil Dinámico:** Panel para visualizar y actualizar datos de la cuenta en tiempo real, migrando automáticamente los favoritos si el correo electrónico cambia.
* **📱 Diseño Responsivo y UI/UX:** Interfaz fluida e interactiva construida con Tailwind CSS, incluyendo feedback visual (spinners, notificaciones de error/éxito) y alternancia de visibilidad en campos de contraseñas.

## 🛠️ Tecnologías y Herramientas

* **Estructura:** HTML5 semántico.
* **Estilos:** Tailwind CSS v4 (vía CDN) y animaciones nativas.
* **Lógica:** Vanilla JavaScript (ES6+), manipulación del DOM, arreglos y objetos.
* **Iconografía:** FontAwesome v6.7.2.
* **Entorno de Desarrollo:** Visual Studio Code.

## 📁 Estructura de Archivos

\`\`\`text
📦 rick-and-morty-app
 ┣ 📜 login.html       # Interfaz principal de inicio de sesión
 ┣ 📜 register.html    # Formulario de alta de nuevos usuarios
 ┣ 📜 main.html        # Catálogo general de personajes (Protegida)
 ┣ 📜 character.html   # Vista de detalles y estadísticas de un personaje (Protegida)
 ┣ 📜 account.html     # Gestión de perfil y actualización de datos (Protegida)
 ┗ 📜 README.md        # Documentación del repositorio
\`\`\`

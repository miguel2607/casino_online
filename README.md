# 🐱 Michi Casino

Mini casino de estrellitas ⭐ con gatitos. Las estrellitas se ganan jugando y se canjean por cupones de amor que se crean desde el panel de administración.

## Arrancar con Docker (recomendado)

```bash
docker compose up -d --build
```

- App: **http://localhost:8080**
- Admin: usuario y contraseña definidos en `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`)
- PostgreSQL: `localhost:5440`, usuario `michi`, base `michi_casino` (contraseña en `.env`)

Los datos viven en el volumen `michi_data`, así que sobreviven a reinicios y a `docker compose down`.
**No uses `docker compose down -v`**: eso borra el volumen con todas las estrellitas.

Otros comandos:

```bash
docker compose logs -f app      # ver logs
docker compose restart app      # reiniciar la app
docker compose up -d --build    # aplicar cambios de código
docker exec michi-casino-db pg_dump -U michi michi_casino > respaldo.sql   # respaldo
```

## Desarrollo (recarga en caliente)

```bash
docker compose up -d db         # solo la base de datos
npm run install:all             # una vez
npm run dev                     # API en :4000 + frontend en http://localhost:5173
```

La configuración de desarrollo está en `server/.env` (copia de `server/.env.example`).

## Juegos

| Juego | Cómo paga |
|---|---|
| 🃏 Blackjack | Gana x2, blackjack 3:2, se puede doblar |
| 🎡 Ruleta | Europea: pleno 35:1, docena/columna 2:1, colores/par/mitades 1:1 |
| ♠️ Solitario | Fácil x1.5 · Medio x3 · Difícil x5 (la partida se guarda y se puede retomar) |
| 🏁 Carrera de Michis | Cuotas distintas en cada carrera según la probabilidad de cada gato |
| 🎰 Tragamichis | Dos o tres iguales; tres 😻 pagan x100 |
| 🔼 Mayor o Menor | Multiplicador que crece con cada acierto, cobras cuando quieras |
| 📦 Encuentra al Michi | Acertar la cajita paga x2.9 |
| 🎟️ Rasca y Gana | Tres iguales pagan de x1 a x25 |

Todo el azar se decide en el servidor y cada movimiento de estrellitas queda en un libro contable (`transactions`). Cada partida queda en `game_results`.

## Jugar en pareja 💞

En **Pareja** cada uno tiene un código de invitación (por ejemplo `MICHI-4F7KQ`). Uno lo comparte y el otro lo escribe para vincularse. Desde ahí:

- **6 juegos en tiempo real** (Socket.IO): Piedra, papel o tijera · Conecta 4 de Michis · Memoria de Michis · Duelo de Solitario (mismo reparto para los dos) · Blackjack en pareja (los dos contra el crupier) · Carrera en pareja. Cada partida puede ser amistosa o con apuesta: el ganador se lleva el bote.
- **Stickers de michis** que le aparecen al otro al instante.
- **Regalarse estrellitas** con un mensaje.
- **Cupones en ambas direcciones**: en Recompensas cada uno crea cupones para el otro; quien los crea es quien los cumple (pestaña *Por cumplir*). Los cupones creados desde el panel de admin siguen siendo "del casino".

Los juegos individuales siguen funcionando igual para cuando cada uno quiera jugar solo.

### Juegos de habilidad (individuales)

Se paga una entrada y se cobra según el desempeño: 2048 de Michis, Buscaminas, Michi-Wordle, Sudoku (4×4, 6×6, 9×9), Simón Michi, Flappy Michi, Michi Kart (cada pescadito te acelera) y Sprint de 100 m. En los de lógica el servidor reproduce la partida para validarla; en los de acción revisa que el puntaje sea posible.

### En pareja: uno contra el otro

Piedra papel o tijera · Conecta 4 · Memoria · Duelo de Solitario · Carrera en pareja · Batalla Naval · Stop/Basta · Duelo de reflejos · Puntos y cajas · Tres en raya gigante · Duelo de 2048 · Duelo de Wordle · Carrera fantasma · Sprint en vivo.

### En pareja: en equipo contra el casino

Blackjack en pareja · Dibuja y adivina · Memoria contra el reloj · Sopa de letras · Simón en equipo · Relevos · Sprint en equipo. Si el equipo cumple el reto, los dos cobran.

Todos se juegan con el dedo en el celular o con teclado y mouse en PC.

## Panel de administración

- **Canjes**: marcar como cumplido (con mensaje para ella) o cancelar y devolver las estrellitas.
- **Recompensas**: crear, editar, ocultar o eliminar cupones, con stock opcional.
- **Jugadores**: ver historial y regalar (o quitar) estrellitas con un motivo.
- **Ajustes**: estrellitas de bienvenida y monto del bono diario.

Cuando ella ya tenga cuenta, pon `ALLOW_REGISTRATION=false` en `.env` y ejecuta `docker compose up -d` para cerrar el registro.

## Despliegue en Render

1. Render → **New → Blueprint** → conecta este repositorio. Render lee `render.yaml` y crea la base de datos `michi-casino-db` y el web service `michi-casino` (Docker).
2. Cuando lo pida, escribe el valor de `ADMIN_PASSWORD`.
3. Al terminar, la app queda en `https://michi-casino.onrender.com` (o el nombre que Render asigne).

Salud: `GET /health` (o `/api/health`) devuelve `200` si la app y la base están bien y `503` si la base no responde. Úsalo en UptimeRobot cada 5 minutos para que el plan gratuito no se duerma.

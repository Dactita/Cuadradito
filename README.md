# PixelDeck

Un mural de 1600 celdas donde cada una se compra por $500 (configurable) con Mercado Pago.

Esta guía asume que no programaste nunca. Cada paso está para hacerse en orden.

---

## Paso 1 — Crear la base de datos en Supabase

1. Entrá a https://supabase.com y creá una cuenta gratis (con GitHub es lo más rápido).
2. Botón **New Project**. Ponele un nombre (ej: `pixeldeck`) y una contraseña de base de datos
   (guardala en algún lado, no la vas a necesitar en el código, pero por las dudas).
3. Esperá un minuto a que el proyecto termine de crearse.
4. En el menú izquierdo, andá a **SQL Editor** → **New query**.
5. Abrí el archivo `supabase/schema.sql` de esta carpeta, copiá todo su contenido, pegalo ahí, y
   apretá **Run**. Esto crea las dos tablas que necesita el proyecto (`orders` y `cells`).
6. Andá a **Project Settings** (ícono de engranaje) → **Data API**. Ahí vas a ver:
   - **Project URL** → esto es tu `SUPABASE_URL`
   - En la sección **Project API keys**, la clave marcada como **service_role** (no la `anon`)
     → esto es tu `SUPABASE_SERVICE_ROLE_KEY`

   Guardá ambos valores, los vas a pegar en el Paso 4.

⚠️ La `service_role` key es un secreto total: nunca la pongas en el código que subís a GitHub,
ni la compartas. Por eso este proyecto ya está armado para que solo viva en variables de entorno.

---

## Paso 2 — Crear las credenciales de Mercado Pago

1. Entrá a https://www.mercadopago.com.ar/developers/panel y logueate con tu cuenta de Mercado Pago
   (o creá una).
2. Creá una aplicación nueva (te va a preguntar el nombre y qué vas a hacer — elegí algo como
   "Pagos online" / Checkout Pro).
3. Dentro de la aplicación, andá a **Credenciales de producción**.
4. Copiá el **Access Token** de producción → esto es tu `MERCADOPAGO_ACCESS_TOKEN`.

   Para probar sin usar plata real primero, Mercado Pago también te da **Credenciales de prueba**
   con su propio Access Token — usá esas mientras estás probando, y cambiá a las de producción
   recién cuando quieras cobrar de verdad.

---

## Paso 3 — Subir el proyecto a GitHub

1. Entrá a https://github.com/new y creá un repositorio nuevo (puede ser privado), por ejemplo
   `pixeldeck`.
2. En tu computadora, dentro de esta carpeta (`pixeldeck/`), abrí una terminal y corré:

   ```
   git init
   git add .
   git commit -m "Primera versión de PixelDeck"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/pixeldeck.git
   git push -u origin main
   ```

   (Reemplazá `TU-USUARIO` por tu usuario de GitHub. Si nunca usaste `git` en la terminal,
   GitHub Desktop —una app con botones, sin escribir comandos— hace lo mismo: creás el repo,
   arrastrás esta carpeta, y apretás "Publish".)

---

## Paso 4 — Importar el proyecto en Vercel

1. En tu dashboard de Vercel, **Add New → Project**.
2. Elegí el repositorio `pixeldeck` que acabás de subir.
3. Antes de apretar Deploy, abrí **Environment Variables** y cargá estas cuatro, una por una:

   | Nombre | Valor |
   |---|---|
   | `SUPABASE_URL` | el que copiaste en el Paso 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | el que copiaste en el Paso 1 |
   | `MERCADOPAGO_ACCESS_TOKEN` | el que copiaste en el Paso 2 |
   | `NEXT_PUBLIC_SITE_URL` | por ahora dejalo vacío, lo completamos en el paso 5 |
   | `NEXT_PUBLIC_PRICE_PER_CELL` | `500` (o el precio que quieras, en pesos) |

4. Apretá **Deploy**. Vercel te va a dar una URL tipo `pixeldeck-tuusuario.vercel.app`.

---

## Paso 5 — Completar la URL del sitio

1. Copiá la URL que te dio Vercel (o tu dominio propio, si ya lo conectaste).
2. Volvé a **Project → Settings → Environment Variables** en Vercel, editá `NEXT_PUBLIC_SITE_URL`
   y poné esa URL completa, sin barra al final. Ejemplo: `https://pixeldeck-tuusuario.vercel.app`
3. Andá a **Deployments**, abrí el último, y apretá **Redeploy** para que tome el nuevo valor.

Esto es necesario porque el sitio le tiene que avisar a Mercado Pago a dónde mandar la
confirmación del pago (el "webhook"), y para eso necesita saber su propia dirección.

---

## Paso 6 — Conectar tu dominio propio

1. En Vercel: **Project → Settings → Domains** → agregá tu dominio.
2. Vercel te muestra uno o dos registros DNS (tipo `A` o `CNAME`) para cargar donde compraste el
   dominio (Namecheap, Google Domains, NIC.ar, etc.).
3. Una vez que el dominio esté conectado y verificado, repetí el Paso 5 pero con tu dominio propio
   en vez de la URL de `.vercel.app`.

---

## Probar que todo funciona

1. Entrá a tu sitio, elegí un par de celdas, poné un color y tu nombre.
2. Apretá "Pagar con Mercado Pago" — te va a redirigir al checkout.
3. Si usaste credenciales de **prueba**, Mercado Pago te deja pagar con tarjetas de test
   (las encontrás en la misma página de credenciales de prueba, sección "Usuarios de prueba").
4. Volvés al sitio automáticamente, y en unos segundos las celdas deberían aparecer pintadas.

Si no se pintan después de un pago aprobado, lo más probable es que `NEXT_PUBLIC_SITE_URL`
no esté bien puesta (Paso 5), porque el webhook no le llega a Mercado Pago la URL correcta.

---

## ¿Qué hace cada archivo?

- `app/page.js` — la página que ve la gente: el mural, la selección, el botón de pago.
- `app/api/board/route.js` — devuelve qué celdas están pintadas.
- `app/api/checkout/route.js` — crea la orden y el link de pago de Mercado Pago.
- `app/api/webhook/route.js` — Mercado Pago le avisa acá cuando un pago se aprueba, y esta ruta
  pinta las celdas correspondientes.
- `supabase/schema.sql` — la estructura de la base de datos.

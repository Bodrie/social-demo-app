# The Mesh - Social Network Demo App

This repository contains the server-side and client-side code for the project.

---

## 🚨 Development Status: Frozen

For long time active development on this project is **on hold**. No new features or updates are planned.

---

## 🌍 Environments

- **Production:** [~~https://the-mesh.eu~~](https://the-mesh.eu) _(Currently inactive)_
- **Development:** [https://dev-the-mesh.vercel.app](https://dev-the-mesh.vercel.app)

---

## 🖥 Server & Database

- Hosted on a **physical machine** running **Ubuntu Server v23.10**.
- **Nginx** serves the front-end, and **PM2** manages the **Node.js** server instance.
- **Database:** MySQL, but using the `mysql2` package instead of `mysql` in Node.js to avoid query-related issues.

---

## 🚀 Deployment

### Deploy Scripts

This repository contains two shell scripts for deploying the code:

1. **Development Deployment:**

   - While there's no separate development environment, pushing to the `main` branch triggers an automatic deployment to **Vercel**.

2. **Production Deployment:**
   - The script builds the app locally and then uploads it to the **production server** manually.

---

## 📌 To-Do _(Paused)_

- [ ] Add Docker containerization

---

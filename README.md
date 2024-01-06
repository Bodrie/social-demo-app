# Currently the server is down, until 07.01.2024 - 06:00 PM

# The Mesh - Social network demo app

This repo contains server side and client side code for the project.

# Production environment

[https://the-mesh.eu](https://the-mesh.eu)

# Development environment

[https://dev-the-mesh.vercel.app](https://dev-the-mesh.vercel.app)

## Server and DB

The code lives on physical machine which runs on Ubuntu Server v23.10.\
`Nginx` serves the front-end part and `PM2` manages the NodeJS server instance.\
The database is `MySQL`, but the connection in the NodeJS is with package `mysql2` and not `mysql`, this resolves an issue with making query requests to the DB.

## Deploy scripts

This directory contains two shell scripts which are pushing the code respectively to the production and development environment. There is no actual development environment, but if the code is pushed to the main branch it will be automatically deployed to Vercel. And if we want to deploy to production the script is building the app locally and then uploading it to the server.

## TO DO

Add Docker container...
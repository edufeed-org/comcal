# Comcal - Decentralized Community App with a Calendar

[![Node.js](https://img.shields.io/badge/Node.js-v22.16.0-green)](https://nodejs.org/) [![SvelteKit](https://img.shields.io/badge/SvelteKit-2.1.2-orange)](https://kit.svelte.dev/) [![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

Comcal is a decentralized community management and calendar platform built on the **Nostr protocol**. It enables communities to create events, coordinate activities, and share calendars without relying on centralized services. All data is sovereign and stored on Nostr relays—your community maintains full control.

## Table of Contents

- [What is Comcal?](#what-is-comcal)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Quick Start (Development)](#quick-start-development)
- [Development Guide](#development-guide)
- [Deployment](#deployment)
- [Architecture](#architecture)
- [Resources](#resources)

---

## What is Comcal?

Comcal (Community Calendar) provides communities with a **sovereign, decentralized alternative** to centralized calendar and community management tools. Built on the Nostr protocol, it implements:

- [**NIP-52**](https://wikistr.com/nip-52*dd664d5e4016433a8cd69f005ae1480804351789b59de5af06276de65633d319): Calendar Events standard for event management
- [**Communikey NIP**](https://wikistr.com/nip-communikey*a9434ee165ed01b286becfc2771ef1705d3537d051b387288898cc00d5c885be): Community operations and management

Communities maintain full autonomy—no central server, no data lock-in, no platform dependency. Users authenticate with their private keys, ensuring complete control over their identity and data.

### Use Cases

- **Community Organizers**: Manage events and coordinate activities
- **Educational Institutions**: Coordinate study groups, lectures, and events
- **Interest-Based Communities**: Share calendars and coordinate meetings
- **Any Group**: Needing sovereign event coordination without centralized infrastructure


## Key Features

- ✅ **Community Management**: Create, join, and manage communities with full autonomy
- ✅ **Calendar System**: Decentralized calendar events with NIP-52 compliance
- ✅ **Multi-Calendar Support**: Personal and community-level calendars
- ✅ **Calendar Sharing**: Multiple sharing mechanisms (webcal, QR codes, direct links)
- ✅ **Private Key Authentication**: Secure, sovereignty-preserving authentication
- ✅ **Social Features**: Community feeds, member profiles, and interaction
- ✅ **Map Integration**: Location-based event discovery
- ✅ **Markdown Support**: Rich text content in events and profiles


## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Runtime** | Node.js | v22.16.0 |
| **Frontend Framework** | SvelteKit | 2.1.2 |
| **Svelte Version** | Svelte | 5.0.0 |
| **Styling** | TailwindCSS | 3.4.10 |
| **Components** | DaisyUI | 4.12.10 |
| **State Management** | Svelte 5 Runes | Native |
| **Protocol** | Nostr | NIP-52, Communikey NIP |
| **Nostr Libraries** | Applesauce Suite | Latest |
| **Deployment** | Docker + Traefik | Production-ready |
| **Adapter** | @sveltejs/adapter-node | 6.0.0 |


## Quick Start (Development)

### Prerequisites

- **Node.js**: v22.16.0 (see `.nvmrc`)
- **npm**: Comes with Node.js
- **Git**: For cloning the repository

### Installation

```bash
# Clone the repository
git clone <repository-url> comcal
cd comcal

# Install dependencies
npm install
```

### Running the Development Server

```bash
# Start the dev server (runs on http://localhost:5173)
npm run dev

# Or open automatically in browser
npm run dev -- --open
```

### Building for Production

```bash
# Build the application
npm run build

# Preview production build locally
npm run preview
```

---

## Development Guide

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload

# Production
npm run build            # Build for production (Node adapter)
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier

# Docker
docker compose build     # Build Docker image
docker compose up -d     # Start containers in background
docker compose logs -f   # View logs
```

### Development Workflow

1. **Start the dev server**: `npm run dev`
2. **Make changes**: Edit components, stores, or helpers
3. **See hot reload**: Changes apply instantly in the browser
4. **Run linting**: `npm run lint` to check code quality
5. **Format code**: `npm run format` to maintain style consistency

### Key Technologies in Use

- **SvelteKit**: Full-stack framework with server routes and API endpoints
- **Svelte 5 Runes**: Reactive state management with `$state`, `$derived`, `$effect`
- **TailwindCSS**: Utility-first CSS for styling
- **DaisyUI**: Component library on top of Tailwind
- **Nostr Protocol**: Decentralized event protocol
- **Applesauce**: Suite of libraries for Nostr interaction


## Deployment

Comcal is designed for production deployment using Docker and Traefik. This section covers deploying to a VPS or self-hosted server.

### Prerequisites for VPS/Server Deployment

- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **Docker**: Latest version
- **Docker Compose**: v2+ with plugin support
- **Domain Name**: For SSL certificates via Let's Encrypt
- **Ports**: 80 and 443 publicly accessible
- **Resources**: 512MB RAM minimum (1GB recommended), 1-2GB storage

### Prerequisites for Local Development

See [Quick Start](#quick-start-development) section above.

### Step 1: Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose v2+
sudo apt install docker-compose-plugin

# Add user to docker group (optional, for non-root docker access)
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Clone Repository

```bash
# Clone the repository
git clone <repository-url> comcal
cd comcal
```

### Step 3: Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**

```env
# Your domain (required for SvelteKit CSRF protection)
ORIGIN=https://your-domain.com

# Internal service port (usually 3000)
PORT=3000

# Node environment
NODE_ENV=production
```

### Step 4: Configure Docker Compose

Edit `docker-compose.yml` and update:

1. **Service name** (if needed): Default is `comcal`
2. **Domain**: Replace `your-domain.com` with your actual domain in Traefik labels
3. **Traefik network**: Ensure `traefik_web` matches your Traefik setup

Example Traefik configuration:

```yaml
labels:
  - "traefik.http.routers.comcal.rule=Host(`your-domain.com`)"
  - "traefik.http.routers.comcal.entrypoints=websecure"
  - "traefik.http.routers.comcal.tls.certresolver=letsencrypt"
```

### Step 5: Build and Deploy

```bash
# Build the Docker image
docker compose build

# Start the application in detached mode
docker compose up -d

# View real-time logs
docker compose logs -f
```

### Step 6: Verify Deployment

```bash
# Check container status
docker compose ps

# Check application logs
docker compose logs comcal

# Test endpoint from server
curl http://localhost:3000
```

---

## Container Management Commands

### Viewing Logs

```bash
# View all logs
docker compose logs

# View specific service logs
docker compose logs comcal

# Follow logs in real-time
docker compose logs -f

# View last 100 lines
docker compose logs --tail 100

# Search logs for errors
docker compose logs | grep -i error
```

### Stopping and Starting

```bash
# Stop all services
docker compose stop

# Start all services
docker compose start

# Restart services
docker compose restart

# Restart specific service
docker compose restart comcal
```

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker compose build --no-cache

# Restart with new image
docker compose up -d

# Verify deployment
docker compose logs -f
```

### Cleanup and Removal

```bash
# Remove stopped containers
docker container prune

# Remove dangling images
docker image prune

# Remove all stopped containers and unused images
docker system prune

# Remove entire application
docker compose down -v
```

### Monitor Performance

```bash
# Real-time container statistics
docker stats

# Monitor specific container
docker stats comcal

# Export stats to file for analysis
docker stats --no-stream > stats.txt
```


## Architecture

### Key Components

**Frontend Layer** (SvelteKit):
- Route handlers for page rendering
- API endpoints for backend logic
- Svelte components for UI
- Reactive stores for state management

**Data Layer** (Nostr Relays):
- No central database
- All data stored on Nostr relays
- Events are immutable and signed
- Clients subscribe to and publish events

**Security**:
- Private key authentication
- Non-root Docker user (nodejs:1001)
- Alpine Linux base image (minimal attack surface)
- HTTPS via Traefik + Let's Encrypt

### Data Flow

1. User authenticates with private key
2. Application publishes/subscribes to Nostr relays
3. Calendar events stored as signed Nostr events
4. Communities managed via communikey NIP
5. No persistent data on application server

### Development vs. Production

| Aspect | Development | Production |
|--------|------------|------------|
| **Node Version** | v22.16.0 | v22 Alpine |
| **Build Output** | Hot reload, detailed errors | Optimized, minified |
| **Port** | 5173 (Vite) | 3000 (Node server) |
| **Environment** | NODE_ENV=development | NODE_ENV=production |
| **SSL/TLS** | None (localhost) | Let's Encrypt via Traefik |
| **Command** | `npm run dev` | `docker compose up -d` |
| **Database** | N/A (Nostr relays) | N/A (Nostr relays) |


## Resources & Support

### Protocol Documentation

- **[Nostr Protocol](https://nostr.com)**: Overview of the Nostr protocol
- **[NIP-52: Calendar Events](https://github.com/nostr-protocol/nips/blob/master/52.md)**: Calendar event standard
- **[Communikey NIP](https://wikistr.com/nip-communikey)**: Community operations specification

### Framework & Libraries

- **[SvelteKit Documentation](https://kit.svelte.dev)**: Full framework documentation
- **[SvelteKit Node Adapter](https://github.com/sveltejs/kit/tree/main/packages/adapter-node)**: Node.js deployment
- **[Svelte 5 Documentation](https://svelte.dev)**: Latest Svelte features
- **[TailwindCSS](https://tailwindcss.com)**: Utility-first CSS framework
- **[DaisyUI](https://daisyui.com)**: Tailwind component library

### Deployment & Infrastructure

- **[Docker Documentation](https://docs.docker.com)**: Containerization platform
- **[Traefik Documentation](https://doc.traefik.io)**: Reverse proxy and load balancer
- **[Let's Encrypt](https://letsencrypt.org)**: Free SSL/TLS certificates

### Getting Help

1. **Check Troubleshooting**: See [Troubleshooting](#troubleshooting) section above
2. **Review Logs**: Use `docker compose logs` for application logs
3. **Open Issues**: Report bugs on the repository
4. **Community**: Join Nostr communities discussing comcal

---

## Contributing

Contributions are welcome!


**Built with ❤️ on the Nostr protocol.**

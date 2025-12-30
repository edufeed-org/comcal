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

Comcal uses a **12-factor app approach** with runtime environment variables for configuration. This allows you to use the same Docker image across different environments (development, staging, production) by simply changing environment variables.

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

#### Required Environment Variables

```env
# Your domain (required for SvelteKit CSRF protection)
ORIGIN=https://your-domain.com

# Internal service port (usually 3000)
PORT=3000

# Node environment
NODE_ENV=production
```

#### Complete Configuration Reference

The `.env.example` file contains all available configuration options. Key categories:

**App Branding**
- `APP_NAME`: Application name (default: "ComCal")
- `APP_LOGO`: URL to application logo
- `APP_GIT_REPO`: Git repository URL

**Nostr Relays**
- `RELAYS`: Primary relays for calendar events (comma-separated)
- `FALLBACK_RELAYS`: Fallback relays for event discovery
- `AMB_RELAYS`: Educational content relays with NIP-50 search support

**Calendar Settings**
- `CALENDAR_WEEK_START_DAY`: Week start day (0=Sunday, 1=Monday)
- `CALENDAR_LOCALE`: Date/time locale (e.g., de-DE, en-US)
- `CALENDAR_TIME_FORMAT`: Time format (12h or 24h)

**Signup**
- `SIGNUP_SUGGESTED_USERS`: Suggested users to follow (comma-separated npubs)

**Media Uploads (Blossom)**
- `BLOSSOM_UPLOAD_ENDPOINT`: Blossom server upload endpoint
- `BLOSSOM_MAX_FILE_SIZE`: Maximum file size in bytes

**Geocoding (OpenCage API)**
- `GEOCODING_API_KEY`: **SECRET** - OpenCage API key (never expose to client)
- `GEOCODING_CACHE_DURATION_DAYS`: Cache duration for geocoded results
- `GEOCODING_MIN_ADDRESS_LENGTH`: Minimum address length for geocoding
- `GEOCODING_MIN_CONFIDENCE_SCORE`: Minimum confidence score (0-10)
- `GEOCODING_REQUIRE_ADDRESS_COMPONENTS`: Require address components (true/false)
- `GEOCODING_ACCEPTED_COMPONENT_TYPES`: Accepted component types (comma-separated)

**Imprint/Legal Information**
- `IMPRINT_ENABLED`: Enable/disable imprint page
- `IMPRINT_ORGANIZATION`: Organization name
- `IMPRINT_ADDRESS_*`: Address fields
- `IMPRINT_CONTACT_*`: Contact information
- `IMPRINT_*`: Other legal information

**Educational Content**
- `EDUCATIONAL_SEARCH_DEBOUNCE_MS`: Search debounce delay
- `EDUCATIONAL_VOCAB_*`: SKOS vocabulary keys

See `.env.example` for complete documentation of all variables with descriptions and defaults.

#### Security Best Practices

1. **Never commit `.env` files** - They are in `.gitignore` by default
2. **Protect API keys** - The `GEOCODING_API_KEY` is kept server-side only
3. **Use strong values** - Especially for production deployments
4. **Rotate secrets regularly** - Update API keys periodically
5. **Environment-specific configs** - Use different `.env` files for dev/staging/production

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

## Funding

This project was funded by the BMBSFJ.

Förderkennzeichen: 01PZ24007

![Logo BMBSFJ](/static/BMBFSFJ.png)

Further development happens under funding of Stiftung Innovation in der Hochschullehre:

![Logo STIL](https://blossom.edufeed.org/c9a88acfbf57042191cfb97bafd288436ae959dd0239d5d47b91aa66465205a3.webp)


## Contributing

Contributions are welcome!


**Built with ❤️ on the Nostr protocol.**

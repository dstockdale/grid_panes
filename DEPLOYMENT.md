# 🚀 GridPanes Deployment Guide

This guide walks you through deploying GridPanes to a Linode VPS using Kamal 2.

## 📋 Prerequisites

1. **Linode Account & Server**
   - 2GB Shared CPU instance (Ubuntu 22.04 LTS)
   - Your server IP address
   - SSH access configured

2. **Domain & DNS** (Optional but recommended)
   - A domain pointed to your server IP
   - Or use your server IP directly for testing

3. **Docker Hub Account**
   - For storing your app's Docker image
   - Free account is sufficient

4. **Local Requirements**
   - Ruby (for Kamal gem)
   - Docker (for building images)
   - Git

## 🛠️ Step-by-Step Deployment

### 1. Server Setup

SSH into your Linode server and run the initial setup:

```bash
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl start docker
systemctl enable docker

# Create directory for SSL certificates
mkdir -p /letsencrypt
touch /letsencrypt/acme.json
chmod 600 /letsencrypt/acme.json
```

### 2. Local Setup

Install Kamal and prepare your local environment:

```bash
# Install Kamal
gem install kamal

# Navigate to your project
cd /path/to/grid_panes

# Copy and configure environment
cp .env.example .env
```

### 3. Configure Environment

Edit your `.env` file with your actual values:

```bash
# Generate secrets
mix phx.gen.secret  # Use this for SECRET_KEY_BASE
mix phx.gen.secret  # Use this for LIVE_VIEW_SIGNING_SALT

# Example .env configuration
DATABASE_URL=postgresql://gridpanes:your_strong_password@postgres:5432/gridpanes_prod
POSTGRES_PASSWORD=your_strong_password
SECRET_KEY_BASE=your_generated_secret_key_base
LIVE_VIEW_SIGNING_SALT=your_generated_signing_salt
DOCKER_USERNAME=your_dockerhub_username
DOCKER_PASSWORD=your_dockerhub_password
SERVER_IP=your.server.ip.address
DOMAIN=your-domain.com  # or your.server.ip.address
EMAIL=your-email@example.com
```

### 4. Update Configuration

Edit `config/deploy.yml` and replace the placeholder values:
- `YOUR_SERVER_IP` → Your Linode server IP
- `your-domain.com` → Your domain or server IP
- `your-email@example.com` → Your email for Let's Encrypt
- `your-dockerhub-username` → Your Docker Hub username

### 5. Deploy

Run the deployment script:

```bash
./bin/deploy
```

Or deploy manually:

```bash
# Login to Docker Hub
docker login

# Setup Kamal (first time only)
kamal setup

# For subsequent deployments
kamal deploy
```

## 📊 Post-Deployment

### Verify Deployment

```bash
# Check app status
kamal app logs

# Check all services
kamal status

# Check database
kamal accessory logs postgres

# SSH into server to debug
kamal app exec --interactive bash
```

### Database Management

```bash
# Run migrations
kamal app exec "bin/grid_panes eval \"GridPanes.Release.migrate\""

# Access database directly
kamal accessory exec postgres psql -U gridpanes -d gridpanes_prod
```

### SSL Certificate

If using a domain, Let's Encrypt will automatically provision SSL certificates. Check the logs:

```bash
kamal traefik logs
```

## 🔧 Common Issues & Solutions

### 1. Database Connection Issues
```bash
# Check if PostgreSQL is running
kamal accessory status postgres

# Restart PostgreSQL
kamal accessory restart postgres
```

### 2. SSL Certificate Problems
```bash
# Check Traefik logs
kamal traefik logs

# Ensure your domain points to the server IP
# Ensure ports 80 and 443 are open
```

### 3. App Won't Start
```bash
# Check app logs
kamal app logs

# Common issues:
# - Missing environment variables
# - Database not accessible
# - Build failures
```

### 4. Build Failures
```bash
# Build locally to debug
docker build -t gridpanes .

# Check for:
# - Missing dependencies
# - Asset compilation issues
# - Elixir/OTP version mismatches
```

## 🔄 Updates & Redeployment

For code updates:

```bash
# Commit your changes
git add .
git commit -m "Your update message"

# Deploy
kamal deploy
```

For configuration changes:

```bash
# Update config/deploy.yml or .env
# Then redeploy
kamal deploy
```

## 💾 Backup Strategy

### Database Backups
```bash
# Create backup
kamal accessory exec postgres pg_dump -U gridpanes gridpanes_prod > backup.sql

# Restore backup
kamal accessory exec postgres psql -U gridpanes -d gridpanes_prod < backup.sql
```

### Volume Backups
Important directories to backup:
- `/var/lib/postgresql/data` (PostgreSQL data)
- `/var/lib/redis/data` (Redis data)
- `/letsencrypt/acme.json` (SSL certificates)

## 📈 Monitoring

### Resource Usage
```bash
# Check server resources
ssh root@YOUR_SERVER_IP
htop
df -h
```

### Application Metrics
```bash
# App performance
kamal app logs | grep -i error

# Database performance
kamal accessory exec postgres psql -U gridpanes -d gridpanes_prod -c "SELECT * FROM pg_stat_activity;"
```

## 🔒 Security Considerations

1. **Firewall**: Configure UFW to only allow necessary ports
2. **SSH**: Disable password authentication, use keys only
3. **Updates**: Regularly update the server OS
4. **Backups**: Implement automated backup strategy
5. **Monitoring**: Set up basic monitoring and alerts

## 📞 Support

- Check logs: `kamal app logs`, `kamal accessory logs postgres`
- Kamal docs: https://kamal-deploy.org/
- Phoenix deployment: https://hexdocs.pm/phoenix/deployment.html

Remember: This is a single-server setup suitable for development/testing. For production, consider:
- Separate database server
- Load balancer
- Automated backups
- Monitoring system
- Multiple app instances
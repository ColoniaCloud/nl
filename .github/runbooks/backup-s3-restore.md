# 🆘 Runbook: Restore Backup from S3

**Last Updated**: 2026-04-14  
**Criticality**: HIGH  
**RTO**: 30 minutes  
**RPO**: 24 hours (daily backup)

---

## Scenario: Disaster Recovery from S3

Use this procedure when:
- Local disk corrupted or full
- Database completely lost
- Entire VPS destroyed
- Need to migrate to new server

---

## Prerequisites

- [ ] Files downloaded from S3 (or ready to download)
- [ ] New Docker + Docker Compose installed
- [ ] SSH access to server/VPS
- [ ] AWS CLI configured with credentials
- [ ] Free disk space: 50+ GB

---

## 📋 Step-by-Step Restore

### Phase 1: Preparation (5 min)

```bash
# 1. SSH into new/recovered server
ssh root@vps-ip

# 2. Install Docker (if needed)
curl -sSL https://get.docker.com | bash

# 3. Git clone the repo
cd /opt
git clone https://github.com/wp-uruguay/nl360-escritorio.git docker-apps
cd docker-apps

# 4. Copy latest config from safe location (or rebuild minimal)
# If you have backup of config/ directory:
cp /backup/config /opt/docker-apps/config

# If not, copy .env.example and populate manually:
cp config/.env.example config/.env.production
nano config/.env.production  # Fill in secrets
```

### Phase 2: Download Backup from S3 (10 min)

```bash
# 1. Install AWS CLI
apt update && apt install -y awscli

# 2. Configure AWS credentials (temporarily)
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="wJalr..."
export AWS_DEFAULT_REGION="us-east-1"

# 3. List available backups
S3_BUCKET="nl360-backups-prod"
aws s3 ls s3://$S3_BUCKET/backups/daily/ --recursive

# 4. Download latest MySQL backup
LATEST_SQL=$(aws s3 ls s3://$S3_BUCKET/backups/daily/ \
  --recursive | grep "\.sql$" | sort | tail -1 | awk '{print $NF}')

echo "Downloading: $LATEST_SQL"

aws s3 cp "s3://$S3_BUCKET/$LATEST_SQL" /tmp/backup.sql

# 5. Download volumes archive
LATEST_VOLUMES=$(aws s3 ls s3://$S3_BUCKET/backups/daily/ \
  --recursive | grep "volumes.*\.tar\.gz$" | sort | tail -1 | awk '{print $NF}')

echo "Downloading: $LATEST_VOLUMES"

aws s3 cp "s3://$S3_BUCKET/$LATEST_VOLUMES" /tmp/volumes.tar.gz

# 6. Verify downloads
ls -lh /tmp/backup.sql /tmp/volumes.tar.gz
```

### Phase 3: Start MySQL & Restore Database (5 min)

```bash
# 1. Start only MySQL service
cd /opt/docker-apps
docker compose up -d mysql

# 2. Wait for MySQL to be ready
echo "Waiting for MySQL to start..."
sleep 15

# 3. Source .env for credentials
source config/.env.production || source config/secrets/.env.production

# 4. Restore MySQL dump
echo "Restoring database... (this may take 5-10 minutes)"
docker compose exec mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" < /tmp/backup.sql

# 5. Verify restore completed
docker compose exec mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"
```

### Phase 4: Restore Volumes (5 min)

```bash
# 1. Extract volumes archive
echo "Extracting volumes..."
tar xzf /tmp/volumes.tar.gz -C /opt/docker-apps --preserve-permissions

# 2. Verify key files restored
ls -la /opt/docker-apps/wordpress/index.php
ls -la /opt/docker-apps/config/secrets/.env.production
ls -la /opt/docker-apps/n8n/database.sqlite*

# 3. Update .env symlink (if needed)
ln -sf config/secrets/.env.production /opt/docker-apps/.env

# 4. Cleanup temp files
rm /tmp/backup.sql /tmp/volumes.tar.gz
```

### Phase 5: Start Full Stack (5 min)

```bash
# 1. Start all services
cd /opt/docker-apps
docker compose up -d

# 2. Wait for services to initialize
echo "Waiting for services to start..."
sleep 30

# 3. Monitor logs (Ctrl+C after 5 min if no errors)
docker compose logs -f

# 4. Quick health checks
curl -I https://nl360.site
curl -I https://api.nl360.site/wp-json
curl -I https://automata.nl360.site
```

### Phase 6: Verification (5 min)

```bash
# 1. Check all containers running
docker compose ps
# All should show "Up X minutes"

# 2. Test WordPress API
curl -s https://api.nl360.site/wp-json | jq .

# 3. Test Login
curl -X POST https://nl360.site/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@test.com", "password":"..."}'

# 4. Check database integrity
docker compose exec mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e \
  "SELECT COUNT(*) as posts FROM wordpress.wp_posts;"
docker compose exec mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e \
  "SELECT COUNT(*) as projects FROM manu_dev.md_projects;"

# 5. Check disk space
du -sh /opt/docker-apps/sites/
du -sh /opt/docker-apps/wordpress/

# 6. Test Manu Dev (if applicable)
# Navigate to https://nl360.site/services/manu-dev
# Try creating a test project in chat
```

---

## 🆘 Troubleshooting

### Problem: "MySQL password incorrect"

```bash
# Verify environment variable
echo $MYSQL_ROOT_PASSWORD

# If empty, source it
source /opt/docker-apps/config/secrets/.env.production
echo $MYSQL_ROOT_PASSWORD

# Try restore again with explicit password
docker compose exec mysql mysql -u root -p[PASSWORD] < /tmp/backup.sql
```

### Problem: "Disk full during restore"

```bash
# Check space
du -h /opt/docker-apps/

# If volumes.tar.gz too large, extract incrementally
cd /opt/docker-apps
tar xzf /tmp/volumes.tar.gz --to-stdout | tar x -C .

# Or delete temporary files
rm /tmp/*.sql /tmp/*.tar.gz
```

### Problem: "Containers stuck in starting"

```bash
# Check logs
docker compose logs [service]

# Common issue: port already in use
netstat -tlnp | grep -E "3000|3306|5678|80|443"

# Stop conflicting services
systemctl stop nginx  # if running

# Restart docker-compose
docker compose down
docker compose up -d
```

### Problem: "WordPress plugins broken after restore"

```bash
# Re-generate .htaccess
docker compose exec wordpress wp rewrite flush --hard

# Clear cache
docker compose exec wordpress wp cache flush

# Update plugins
docker compose exec wordpress wp plugin update --all
```

---

## 📊 Success Criteria

After completing all steps, verify:

- [ ] All containers running: `docker compose ps`
- [ ] nl360.site accessible: HTTPS working
- [ ] Login works: Can authenticate
- [ ] Database populated: WordPress posts visible
- [ ] Manu Dev projects: Previous projects loadable
- [ ] N8N workflows: Workflows restored
- [ ] Storage not full: `df -h` shows < 80%
- [ ] Logs clean: No errors in `docker compose logs`

---

## ⏱️ Timeline Summary

| Phase | Duration | Notes |
|-------|----------|-------|
| Prep | 5 min | Install deps |
| Download from S3 | 10 min | Network dependent |
| Restore MySQL | 5 min | Depends on backup size |
| Restore Volumes | 5 min | Extract tar |
| Start Stack | 5 min | Services initialize |
| Verify | 5 min | Health checks |
| **TOTAL** | **~35 min** | Realistic RTO |

---

## 🔐 Post-Restore Security

```bash
# 1. Rotate MySQL password immediately
# (See RESTRUCTURING-PLAN.md for rotate-secrets.sh)

# 2. Rotate all API keys
# (S3, OpenAI, Anthropic, etc.)

# 3. Audit access logs
tail -100 /var/log/auth.log

# 4. Change SSH keys (if compromised)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519

# 5. Update backups (restart script runs 02:00 UTC)
# Or trigger manually: /opt/docker-apps/scripts/backup.sh
```

---

## 📞 Quick Reference

| What | Command |
|------|---------|
| Download latest backup | `aws s3 ls s3://bucket/backups/daily/ --recursive` |
| Extract volumes | `tar xzf volumes_*.tar.gz -C /opt/docker-apps` |
| Restore MySQL | `docker compose exec mysql mysql -u root -p < backup.sql` |
| Check logs | `docker compose logs [service] \| tail -50` |
| Health status | `docker compose ps && curl -I https://nl360.site` |
| Cleanup temps | `rm /tmp/backup.sql /tmp/volumes.tar.gz` |

---

## 💡 Best Practices

1. **Test restore monthly**: Don't assume backups work until verified
2. **Keep local + remote**: Local for speed, S3 for safety
3. **Document everything**: Update this runbook after each incident
4. **Automate when possible**: Less manual = fewer errors
5. **Alert on failure**: Backup without alerts = worthless

---

**Last Tested**: YYYY-MM-DD  
**Next Test Date**: YYYY-MM-DD + 30 days  
**Tested By**: [Your Name]  
**Issue Link**: [GitHub Issue if applicable]

---

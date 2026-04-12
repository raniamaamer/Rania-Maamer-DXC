#!/bin/sh
# Attend que SonarQube soit prêt
echo "Waiting for SonarQube to start..."
until curl -s -u admin:admin "http://sonarqube:9000/api/system/status" | grep -q '"status":"UP"'; do
  echo "SonarQube not ready yet, waiting 5s..."
  sleep 5
done

echo "SonarQube is UP. Configuring..."

# Changer le mot de passe par défaut
curl -s -u admin:admin -X POST \
  "http://sonarqube:9000/api/users/change_password" \
  -d "login=admin&previousPassword=admin&password=admin123"

echo "Password changed."

# Créer le token Jenkins
TOKEN_RESPONSE=$(curl -s -u admin:admin123 -X POST \
  "http://sonarqube:9000/api/user_tokens/generate" \
  -d "name=jenkins-token&type=GLOBAL_ANALYSIS_TOKEN")

echo "$TOKEN_RESPONSE" > /opt/sonarqube/data/jenkins-token.json
echo "Token generated: $TOKEN_RESPONSE"

# Créer le webhook vers Jenkins
curl -s -u admin:admin123 -X POST \
  "http://sonarqube:9000/api/webhooks/create" \
  -d "name=Jenkins&url=http://host.docker.internal:9090/sonarqube-webhook/"

echo "Webhook created."
echo "SonarQube configured successfully!"
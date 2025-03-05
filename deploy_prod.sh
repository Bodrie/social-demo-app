echo "Switching to main branch..."
git checkout main

echo "Building app..."
cd client
npm run build

echo "Deploying to server..."
scp -r build/* $DEPLOY_USER@$DEPLOY_HOST:/var/www/the-mesh.eu

echo "Done!"

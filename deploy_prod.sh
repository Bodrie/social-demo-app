echo "Switching to main branch..."
git checkout main

echo "Building app..."
npm run build

echo "Deploying to server..."
scp -r build/* bodrie-server@79.100.23.39:/var/www/the-mesh.eu

echo "Done!"

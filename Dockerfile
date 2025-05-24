
# Stage 1: Build the application
FROM node:18-slim AS build

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install all dependencies, including devDependencies for the build
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Vite frontend and transpile TypeScript
# This assumes your `build` script in package.json handles both tsc and vite build
RUN npm install -g typescript && npm run build

# Stage 2: Production environment
FROM node:18-slim AS production

WORKDIR /app

# Copy package.json and package-lock.json for production dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the built assets from the build stage
# The `dist` folder is the default output for `vite build`
# The `server.js` is needed to run the server
# Copy other necessary files like index.html if they are not in `dist` but are served directly
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/index.html ./
# If you have other static assets in the root that server.js serves directly (like index.css)
# ensure they are copied here as well. For example:
COPY --from=build /app/index.css ./

# Expose the port the app runs on.
# Google Cloud Run sets the PORT environment variable, which server.js uses.
EXPOSE 8080

# Command to run the application
CMD ["node", "server.js"]

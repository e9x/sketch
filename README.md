# Sketch

## Building

1. Clone this repository

   ```sh
   git clone ...
   ```

2. Install dependencies

   ```sh
   npm install
   ```

3. Configure your `.env` file

   ```
   SKETCH_API_URL=http://127.0.0.1:3001/
   SKETCH_LINKVERTISE_URL=https://link-target.net/...
   # the actual page that they get redirected to, not URL
   SKETCH_LINKVERTISE_PAGE=https://linkvertise.com/...
   SKETCH_SUPPORTED_GAME=b81c2a2bf4db6...
   ```

4. Build

   For production, set `NODE_ENV`. By default, development builds will be produced.

   ```sh
   NODE_ENV=production npm run build
   ```

   ```sh
   npm run build
   ```

# Your Calendar Scout

This is the source code for the Your Calendar Scout landing page.

## How to Deploy this Site

Since you're looking to put this on the web using GitHub and Netlify, here is the simplest way to do it without needing to use any complex "coding tools" on your computer.

### Step 1: Create a GitHub Account
If you don't have one, go to [github.com](https://github.com) and sign up for a free account.

### Step 2: Create a New Repository
1. On GitHub, click the **+** icon in the top right and select **New repository**.
2. Give it a name (like `calendar-scout`).
3. Keep it **Public** (or Private if you prefer).
4. Click **Create repository**.

### Step 3: Upload your files
1. On your new repository page, look for the link that says "uploading an existing file".
2. You will need to upload all the files from this project **except** for the `node_modules` folder (if you see one) and the `dist` folder.
3. **Important files to include:**
   - `src/` (the whole folder)
   - `public/` (if it exists)
   - `index.html`
   - `package.json`
   - `tsconfig.json`
   - `vite.config.ts`
   - `.gitignore`

### Step 4: Connect to Netlify
1. Go to [netlify.com](https://netlify.com) and sign up (you can sign up using your GitHub account).
2. Click **Add new site** -> **Import an existing project**.
3. Select **GitHub**.
4. Find and select your `calendar-scout` repository.
5. Netlify will automatically detect the settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Click **Deploy site**.

Your site will be live in a minute or two! Netlify will give you a random link (like `shiny-scout-123.netlify.app`), which you can change later in the site settings.

---

## Technical Details (For Reference)

This site is built with:
- **React 19** (The framework)
- **Vite** (The build tool)
- **Tailwind CSS** (The styling)
- **Lucide React** (The icons)
- **Motion** (The animations)

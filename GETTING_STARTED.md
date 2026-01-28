# NBA Predictor - Getting Started Guide

This guide will walk you through setting up the NBA Predictor platform from scratch. Since you're new to coding, follow each step carefully.

## Prerequisites Installation

### Step 1: Install Node.js

1. Go to https://nodejs.org/en/download/
2. Download "Windows Installer (.msi)" for 64-bit
3. Run the installer with default settings
4. Open Command Prompt and verify:
   ```bash
   node --version
   ```
   You should see something like `v20.11.0`

### Step 2: Install PostgreSQL

1. Go to https://www.postgresql.org/download/windows/
2. Download the installer (version 16.x recommended)
3. During installation:
   - Remember the password you set for the `postgres` user (you'll need this!)
   - Default port is 5432 (keep it)
   - Install with all default components
4. After installation, open "pgAdmin 4" from Start menu
5. You should see a PostgreSQL server running

### Step 3: Install VS Code

1. Go to https://code.visualstudio.com/
2. Download and install
3. Open VS Code
4. Install extensions (click Extensions icon on left sidebar):
   - Search for "TypeScript" and install
   - Search for "ESLint" and install
   - Search for "Prettier" and install

### Step 4: Install Git (Optional but Recommended)

1. Go to https://git-scm.com/download/win
2. Download and install with default settings

## Project Setup

### Backend Setup

1. **Open Command Prompt** (press Windows + R, type `cmd`, press Enter)

2. **Navigate to project directory:**
   ```bash
   cd "d:\Personal AI Projects\NBA Predictor\backend"
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```
   This will take a few minutes. You'll see a progress bar downloading packages.

4. **Create environment file:**
   ```bash
   copy .env.example .env
   ```

5. **Edit the .env file:**
   - Open VS Code
   - File → Open Folder → Select `d:\Personal AI Projects\NBA Predictor\backend`
   - Find `.env` file in the file tree
   - Change this line:
     ```
     DB_PASSWORD=your_postgres_password_here
     ```
     Replace `your_postgres_password_here` with the password you set during PostgreSQL installation
   - Save the file (Ctrl + S)

### Database Setup

1. **Open pgAdmin 4** from Start menu

2. **Connect to PostgreSQL:**
   - You'll see "PostgreSQL 16" in the left sidebar
   - Click to expand it
   - Enter the password you set during installation

3. **Create the database:**
   - Right-click on "Databases"
   - Select "Create" → "Database..."
   - In the "Database" field, type: `nba_predictor`
   - Click "Save"

4. **Run the schema:**
   - Right-click on the `nba_predictor` database you just created
   - Select "Query Tool"
   - Open the file `d:\Personal AI Projects\NBA Predictor\backend\src\db\schema.sql` in a text editor
   - Copy ALL the content
   - Paste it into the Query Tool window
   - Click the "Execute" button (or press F5)
   - You should see a message "Query returned successfully"

### Test the Backend

1. **Back in Command Prompt, run:**
   ```bash
   npm run dev
   ```

2. **You should see:**
   ```
   ✓ Connected to PostgreSQL database
   ✓ Database connection test successful
   🚀 NBA Predictor Backend Server Started
   ✓ Server running on http://localhost:3001
   ```

3. **Open your web browser and go to:**
   ```
   http://localhost:3001/health
   ```

4. **You should see:**
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "timestamp": "2025-01-24T..."
   }
   ```

5. **If you see this, congratulations! Your backend is working!** 🎉

## Troubleshooting

### "npm: command not found"
- Node.js wasn't installed correctly
- Restart your computer after installing Node.js
- Try opening a new Command Prompt window

### "Database connection error"
- Check if PostgreSQL is running (open Services app, look for "postgresql")
- Verify your password in the `.env` file is correct
- Make sure the database `nba_predictor` exists in pgAdmin

### "Cannot find module"
- Run `npm install` again in the backend folder
- Make sure you're in the correct directory (`cd "d:\Personal AI Projects\NBA Predictor\backend"`)

### Port 3001 already in use
- Another program is using that port
- Change PORT=3001 to PORT=3002 in your `.env` file

## Next Steps

Once your backend is running successfully:
1. Keep the backend running (don't close the Command Prompt window)
2. We'll set up the frontend in a new Command Prompt window
3. Then we'll implement the prediction engine
4. Finally, we'll add the data ingestion to fetch real NBA data

## Getting Help

If you encounter any errors:
1. Read the error message carefully
2. Check the troubleshooting section above
3. Make sure all prerequisites are installed
4. Verify your `.env` file has the correct database password

Remember: Every developer faces errors and bugs. It's part of the learning process! 💪

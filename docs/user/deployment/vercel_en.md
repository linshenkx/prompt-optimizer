## Vercel Deployment Guide

### Deployment Method Comparison

| Deployment Method | Advantages | Disadvantages |
|---------|------|------|
| One-click Deployment | Quick and convenient, no additional setup required | Cannot automatically sync updates from the source project |
| Fork and Import | Can track source project updates, easier to maintain | First deployment may require checking the project root and build settings |

### Recommended Method: Fork the Project and Import to Vercel (Recommended)

This method allows you to track project updates, making it easier to sync the latest features and bug fixes.

1. **Fork the project to your GitHub account**
   - Visit the [prompt-optimizer project](https://github.com/linshenkx/prompt-optimizer)
   - Click the "Fork" button in the top right corner
   - After completing the fork operation, you will have a copy of this project under your GitHub account

2. **Import the project to Vercel**
   - Log in to the [Vercel platform](https://vercel.com/)
   - Click "Add New..." → "Project"
   - Find your forked project in the "Import Git Repository" section and click "Import"
   - Configure the project (**Note**: Although you can set the root directory here, it is ineffective for multi-module projects and will still require manual fixing later)
   - Click "Deploy" to start deployment

   ![Import project to Vercel](../images/vercel/import.png)

3. **Check the root directory setting (Recommended)**
   - When deploying through import, make sure the Vercel project root remains the repository root
   - If Vercel automatically detects a subdirectory as the project root, fix it manually:
   
   a. After the project is deployed, go to project settings
   
   b. Click "Build and Deployment" in the left menu
   
   c. In the "Root Directory" section, **clear** the content in the input box
   
   d. Click "Save" to save the settings
   
   ![Clear root directory setting](../images/vercel/setting.png)

4. **Configure environment variables (Optional)**
   - After deployment is complete, go to project settings
   - Click "Environment Variables"
   - Do not preconfigure model API keys for a public Vercel site. `VITE_*` variables are bundled into the frontend build output, so visitors can download those values in the browser. For public sites, let users configure their own API keys in the application UI.
   - Only consider preconfigured `VITE_*` model settings for controlled private deployments, and use keys that are rotatable, scoped, and cost-limited.
   - To add access restriction functionality:
     - Add an environment variable named `ACCESS_PASSWORD`
     - Set a secure password as its value
   - Save the environment variable settings

5. **Redeploy the project**
   - After saving the settings, you need to manually trigger a redeployment to make the fixes and environment variables effective
   - Click "Deployments" in the top navigation bar
   - On the right side of the latest deployment record, click the "..." button
   - Select the "Redeploy" option to trigger redeployment
   
   ![Redeploy the project](../images/vercel/redeploy.png)

6. **Sync upstream updates**
   - Open your forked project on GitHub
   - If there are updates, it will show "This branch is X commits behind linshenkx:main"
   - Click the "Sync fork" button to sync the latest changes
   - Vercel will automatically detect code changes and redeploy

### Alternative Method: One-click Deployment to Vercel

If you only need quick deployment and don't care about subsequent updates, you can use the one-click deployment method:

1. Click the button below to deploy directly to Vercel
   [![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flinshenkx%2Fprompt-optimizer)

2. Follow Vercel's guidance to complete the deployment process
   
   **Advantage:** With one-click deployment, Vercel can usually identify the root directory correctly without manual fixing.

### Password Protected Access

When the `ACCESS_PASSWORD` environment variable is configured, your site will enable password protection:
- A password verification page will be displayed when accessing the site
- Access to the application is granted after entering the correct password
- The system will set a cookie to remember the user, eliminating the need to re-enter the password for a period of time

### About built-in proxy functionality

GlobalCloud XiaoC had Vercel / Docker built-in proxy support in early versions, but current versions have removed built-in model proxy endpoints because of SSRF security risk.

The Web version is still a pure frontend application:

- The browser calls the configured model service directly
- If the model service does not allow browser CORS requests, Vercel deployment cannot bypass that by itself
- If you need a relay, use the desktop app or configure a trusted API relay service yourself

The root `api/auth.js` and `middleware.js` files are only used for access-password verification in Vercel deployments. They are not model API proxy routes.

### Common Issues

1. **Blank page or error after deployment**
   - Check if environment variables are correctly configured
   - View Vercel deployment logs to find the cause of errors

2. **Cannot connect to model API**
   - Confirm the API key is correctly configured
   - Check whether the model service allows browser CORS requests
   - If CORS is blocked, use the desktop app or a self-hosted API relay service

3. **How to update a deployed project**
   - If forked and imported: sync the fork and wait for automatic deployment
   - If one-click deployed: need to redeploy the new version (cannot automatically track source project updates)

4. **How to add a custom domain**
   - Select "Domains" in the Vercel project settings
   - Add and verify your domain
   - Follow the guidance to configure DNS records

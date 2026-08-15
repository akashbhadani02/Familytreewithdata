# Family Tree — Vercel Ready

## User flow
- First person enters only full name and optional photo.
- The system creates a unique link.
- That link is sent to the son/next family member.
- The next person enters only their full name and optional photo.
- A new link is generated for that person.
- Each link is internally attached to its parent, so the tree branch is automatic.
- Users never see or enter generation numbers.

## Local
1. Copy `.env.example` to `.env`.
2. Put your MongoDB Atlas URI in `.env`.
3. `npm install`
4. `npm start`
5. Open `http://localhost:3000`

## Vercel
1. Push this folder to GitHub (do NOT commit `.env`).
2. Import the repo into Vercel.
3. Add Environment Variable `MONGO_URI` in Vercel Project Settings.
4. Deploy.

Photos are stored as data URLs inside MongoDB in this version, so the Vercel filesystem is not used for uploads. Upload limit is 2 MB per photo to keep serverless requests practical.

## Security
The uploaded source archive contained a real MongoDB password in `.env`. This ready ZIP intentionally excludes that secret. Rotate/change that MongoDB database user's password in MongoDB Atlas before using the repository or deploying it.

## Admin flow
After logging in at `/admin`, use **➕ નવી Family બનાવો** to open the family-start page. If no families exist, the same button appears in the empty state.


ADMIN CREATE FAMILY FIX:
The Admin 'નવી Family બનાવો' button now directly creates a Family using /api/family/start, then refreshes and opens the tree.

VERCEL REQUIREMENT:
Set MONGO_URI in Vercel Project Settings > Environment Variables. Redeploy after adding/changing it. Without MONGO_URI, creating a Family cannot save data.
ADMIN_KEY may be set to Akashkey123, but the app also has that fallback.

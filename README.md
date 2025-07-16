# Draft Events Platform

A live draft events platform designed for Twitch streamers and gaming communities.

## Admin Setup

After setting up the project, you'll need to manually promote users to admin status. Only admins can create draft events.

### Promoting a User to Admin

1. Log into your Supabase dashboard
2. Go to the SQL Editor
3. Run the following query to make a user an admin:

```sql
UPDATE profiles 
SET is_admin = true 
WHERE discord_id = 'DISCORD_USER_ID';
```

Or if you know their email:

```sql
UPDATE profiles 
SET is_admin = true 
WHERE id = (
  SELECT id FROM auth.users 
  WHERE email = 'user@example.com'
);
```

### Authentication Setup

This platform uses Discord-only authentication. Make sure to:

1. In your Supabase project, go to Authentication > Providers
2. Enable Discord provider with your Discord app credentials
3. Disable all other providers (Email, Google, etc.)
4. Set your Discord redirect URL to: `https://your-domain.com/auth/callback`

## Features

- **Admin-only event creation**: Only designated admins can create draft events
- **Discord authentication**: Secure login through Discord OAuth
- **Real-time draft management**: Live updates during draft sessions
- **Tournament bracket generation**: Automatic bracket creation after drafts
- **Multi-game support**: Works with FIFA Pro Clubs, NBA 2K, and more

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up your `.env` file with Supabase credentials
4. Run the development server: `npm run dev`
5. Promote your first admin user using the SQL queries above
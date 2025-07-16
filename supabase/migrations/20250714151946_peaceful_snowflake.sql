/*
  # Fix Discord Authentication Profile Creation

  1. Database Functions
    - Create function to handle new user profile creation
    - Ensure profiles are created automatically on first login

  2. Triggers
    - Add trigger to create profile when new auth user is created
    - Handle Discord metadata properly

  3. Security
    - Ensure proper RLS policies for profile creation
*/

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert new profile for the user
  INSERT INTO public.profiles (id, username, discord_id, avatar_url, is_admin)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'avatar_url',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies to allow profile creation
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow the trigger function to insert profiles
DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON profiles;
CREATE POLICY "Enable insert for authenticated users during signup" ON profiles
  FOR INSERT WITH CHECK (true);
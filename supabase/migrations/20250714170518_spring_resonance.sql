/*
  # Handle New Users - Automatic Profile Creation

  1. Database Function
    - `handle_new_user()` - Creates profile automatically when user signs up
    - Extracts username from Discord metadata
    - Sets default values for new profiles

  2. Trigger
    - Fires on INSERT to auth.users table
    - Automatically creates corresponding profile entry
    - Ensures seamless user onboarding

  3. Security
    - Function runs with SECURITY DEFINER (elevated privileges)
    - Only creates profile for the newly inserted user
    - Handles Discord metadata extraction safely
*/

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert a new profile for the user
  INSERT INTO public.profiles (
    id,
    username,
    discord_id,
    avatar_url,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1),
      'User'
    ),
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'avatar_url',
    false,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also create a function to manually create missing profiles (for existing users)
CREATE OR REPLACE FUNCTION public.create_missing_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert profiles for users who don't have them yet
  INSERT INTO public.profiles (
    id,
    username,
    discord_id,
    avatar_url,
    is_admin,
    created_at,
    updated_at
  )
  SELECT 
    u.id,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'username',
      split_part(u.email, '@', 1),
      'User'
    ),
    u.raw_user_meta_data->>'provider_id',
    u.raw_user_meta_data->>'avatar_url',
    false,
    NOW(),
    NOW()
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE p.id IS NULL;
END;
$$;

-- Run the function to create profiles for any existing users without profiles
SELECT public.create_missing_profiles();

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_seed TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Leaderboard scores (one row per user, aggregated)
CREATE TABLE public.leaderboard_scores (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  best_multiplier NUMERIC(10,2) NOT NULL DEFAULT 0,
  best_multiplier_bet NUMERIC(12,2) NOT NULL DEFAULT 0,
  best_multiplier_at TIMESTAMPTZ,
  total_won NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_rounds INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leaderboard_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scores are viewable by everyone"
  ON public.leaderboard_scores FOR SELECT USING (true);
CREATE POLICY "Users can insert own scores"
  ON public.leaderboard_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scores"
  ON public.leaderboard_scores FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX leaderboard_scores_best_multiplier_idx
  ON public.leaderboard_scores (best_multiplier DESC);
CREATE INDEX leaderboard_scores_total_won_idx
  ON public.leaderboard_scores (total_won DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER leaderboard_scores_touch BEFORE UPDATE ON public.leaderboard_scores
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto create profile + score row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_seed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_seed', substr(md5(NEW.id::text), 1, 8))
  );
  INSERT INTO public.leaderboard_scores (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

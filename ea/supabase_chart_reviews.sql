-- Tabla para revisión de charts (Academia)
CREATE TABLE IF NOT EXISTS chart_reviews (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_url    TEXT NOT NULL,
  student_notes TEXT,
  admin_notes  TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE chart_reviews ENABLE ROW LEVEL SECURITY;

-- Estudiantes: insertar sus propias capturas
CREATE POLICY "chart_reviews_insert_own" ON chart_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Estudiantes: leer sus propias capturas
CREATE POLICY "chart_reviews_select_own" ON chart_reviews
  FOR SELECT USING (auth.uid() = user_id);

-- Admin: leer todas
CREATE POLICY "chart_reviews_select_admin" ON chart_reviews
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Admin: actualizar (para agregar notas y marcar reviewed)
CREATE POLICY "chart_reviews_update_admin" ON chart_reviews
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Admin y dueño: eliminar
CREATE POLICY "chart_reviews_delete" ON chart_reviews
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Storage bucket (ejecutar en Supabase Dashboard > Storage o via API)
-- Nombre del bucket: chart-reviews  (público)
-- O crear via SQL con:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chart-reviews', 'chart-reviews', true);
